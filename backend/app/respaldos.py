"""Respaldos: copia de la base y las fotos en un .zip, cada noche y a pedido; y restaurar.

La copia de la base sale con VACUUM INTO, que da un archivo consistente aunque la app esté
escribiendo. Se guardan en BACKUP_DIR (~/LyA-Respaldos), que Google Drive sincroniza: se
sincroniza la copia, nunca la base viva.
"""

import asyncio
import logging
import re
import sqlite3
import tempfile
import threading
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.auth.dependencias import usuario_actual
from app.config import Config
from app.db import SesionDB, crear_motor, migrar
from app.hora import BOGOTA, a_utc
from app.inventario.esquemas import FechaUTC

registro = logging.getLogger(__name__)

router = APIRouter(prefix="/api/respaldos", dependencies=[Depends(usuario_actual)])

BASE = "lya.db"
HORA_DIARIA = time(21)
DIAS_DIARIOS = 30
MESES_MENSUALES = 12
DIAS_PARA_AVISAR = 2
SEGUNDOS_ENTRE_REVISIONES = 600
NOMBRE = re.compile(r"^lya-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(?:-([a-z-]+))?\.zip$")
MOTIVOS = {"diario", "manual", "antes-de-restaurar", "antes-de-actualizar"}
NO_EXISTE = "Ese respaldo no existe."
DANADO = "Ese respaldo está dañado y no se puede restaurar."

# Un solo respaldo o restauración a la vez en todo el proceso.
_cerrojo = threading.Lock()


@dataclass(frozen=True)
class Respaldo:
    nombre: str
    momento: datetime  # hora de Bogotá, con zona
    motivo: str
    tamano: int


def _leer(archivo: Path) -> Respaldo | None:
    m = NOMBRE.match(archivo.name)
    if m is None or not archivo.is_file():
        return None
    a, mes, d, h, mi, s, motivo = m.groups()
    try:
        momento = datetime(int(a), int(mes), int(d), int(h), int(mi), int(s), tzinfo=BOGOTA)
    except ValueError:
        return None
    return Respaldo(archivo.name, momento, motivo or "diario", archivo.stat().st_size)


def listar(config: Config) -> list[Respaldo]:
    """Del más reciente al más viejo."""
    respaldos = [r for a in config.backup_dir.glob("lya-*.zip") if (r := _leer(a))]
    return sorted(respaldos, key=lambda r: r.momento, reverse=True)


def crear(config: Config, motivo: str = "diario", ahora: datetime | None = None) -> Respaldo:
    if motivo not in MOTIVOS:
        raise ValueError(motivo)
    with _cerrojo:
        return _crear(config, motivo, ahora)


def _crear(config: Config, motivo: str, ahora: datetime | None = None) -> Respaldo:
    ahora = (ahora or datetime.now(BOGOTA)).astimezone(BOGOTA)
    sufijo = "" if motivo == "diario" else f"-{motivo}"
    nombre = f"lya-{ahora:%Y-%m-%d-%H%M%S}{sufijo}.zip"
    destino = config.backup_dir / nombre
    config.backup_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=config.backup_dir, prefix=".tmp-") as tmp:
        copia = Path(tmp) / BASE
        conexion = sqlite3.connect(config.data_dir / BASE)
        try:
            conexion.execute("VACUUM INTO ?", (str(copia),))
        finally:
            conexion.close()
        parcial = Path(tmp) / nombre
        with zipfile.ZipFile(parcial, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(copia, BASE)
            fotos = config.data_dir / "fotos"
            if fotos.is_dir():
                for foto in sorted(fotos.iterdir()):
                    if foto.is_file():
                        # Las fotos ya vienen comprimidas en WebP.
                        z.write(foto, f"fotos/{foto.name}", compress_type=zipfile.ZIP_STORED)
        # Se mueve al final: Google Drive nunca ve un .zip a medio escribir.
        parcial.replace(destino)
    registro.info("Respaldo creado: %s", nombre)
    return _leer(destino)


def podar(config: Config, hoy: date | None = None) -> list[str]:
    """Deja todo lo de los últimos 30 días y uno por mes (el más reciente) durante un año."""
    hoy = hoy or datetime.now(BOGOTA).date()
    limite_diario = hoy - timedelta(days=DIAS_DIARIOS)
    meses_vistos: set[tuple[int, int]] = set()
    borrados = []
    for r in listar(config):
        dia = r.momento.date()
        if dia > limite_diario:
            continue
        mes = (dia.year, dia.month)
        antiguedad = (hoy.year - dia.year) * 12 + hoy.month - dia.month
        if mes not in meses_vistos and antiguedad <= MESES_MENSUALES:
            meses_vistos.add(mes)
            continue
        (config.backup_dir / r.nombre).unlink(missing_ok=True)
        borrados.append(r.nombre)
    return borrados


def toca_respaldar(config: Config, ahora: datetime | None = None) -> bool:
    """Si no hay respaldo desde las últimas 9:00 p. m.: la Mac pudo estar apagada a esa hora."""
    ahora = (ahora or datetime.now(BOGOTA)).astimezone(BOGOTA)
    corte = datetime.combine(ahora.date(), HORA_DIARIA, BOGOTA)
    if ahora < corte:
        corte -= timedelta(days=1)
    respaldos = listar(config)
    return not respaldos or respaldos[0].momento < corte


def atrasado(config: Config, ahora: datetime | None = None) -> bool:
    ahora = ahora or datetime.now(BOGOTA)
    respaldos = listar(config)
    return not respaldos or ahora - respaldos[0].momento > timedelta(days=DIAS_PARA_AVISAR)


async def respaldar_cada_noche(config: Config) -> None:
    """Corre dentro del servicio: revisa cada 10 minutos si toca el respaldo diario."""
    while True:
        try:
            if toca_respaldar(config):
                await asyncio.to_thread(crear, config, "diario")
                await asyncio.to_thread(podar, config)
        except Exception:  # noqa: BLE001  (un fallo no debe apagar los respaldos de mañana)
            registro.exception("No se pudo hacer el respaldo diario")
        await asyncio.sleep(SEGUNDOS_ENTRE_REVISIONES)


def restaurar(config: Config, nombre: str, al_cambiar_base) -> Respaldo:
    """Vuelve la base y las fotos al respaldo `nombre`.

    Antes guarda un respaldo de lo actual. El usuario y sus sesiones se conservan: quien
    restaura sigue con su contraseña de hoy y no tiene que volver a entrar.
    `al_cambiar_base(soltar: bool)` suelta las conexiones antes del cambio y las reabre después.
    """
    respaldo = _leer(config.backup_dir / nombre) if NOMBRE.match(nombre) else None
    if respaldo is None:
        raise HTTPException(404, NO_EXISTE)
    with (
        _cerrojo,
        tempfile.TemporaryDirectory(dir=config.data_dir, prefix=".restaurar-") as tmp,
    ):
        carpeta = Path(tmp)
        _extraer(config.backup_dir / nombre, carpeta)
        # Un respaldo viejo puede tener una base de una versión anterior de la app.
        migrar(Config(data_dir=carpeta, backup_dir=config.backup_dir, web_dir=config.web_dir))
        _conservar_acceso(carpeta / BASE, config.data_dir / BASE)
        previo = _crear(config, "antes-de-restaurar")
        al_cambiar_base(True)
        try:
            for extra in ("-wal", "-shm"):
                (config.data_dir / f"{BASE}{extra}").unlink(missing_ok=True)
            (carpeta / BASE).replace(config.data_dir / BASE)
            fotos = config.data_dir / "fotos"
            viejas = carpeta / "fotos-viejas"
            if fotos.exists():
                fotos.replace(viejas)
            nuevas = carpeta / "fotos"
            nuevas.mkdir(exist_ok=True)
            nuevas.replace(fotos)
        finally:
            al_cambiar_base(False)
    registro.info("Restaurado %s; lo anterior quedó en %s", nombre, previo.nombre)
    return previo


def _extraer(archivo: Path, carpeta: Path) -> None:
    try:
        with zipfile.ZipFile(archivo) as z:
            nombres = z.namelist()
            if BASE not in nombres or z.testzip() is not None:
                raise HTTPException(422, DANADO)
            z.extract(BASE, carpeta)
            (carpeta / "fotos").mkdir()
            for n in nombres:
                # Solo fotos/<nombre>: nada de rutas que salgan de la carpeta.
                partes = n.split("/")
                if len(partes) == 2 and partes[0] == "fotos" and re.match(r"^[\w.-]+$", partes[1]):
                    (carpeta / "fotos" / partes[1]).write_bytes(z.read(n))
    except zipfile.BadZipFile as error:
        raise HTTPException(422, DANADO) from error
    conexion = sqlite3.connect(carpeta / BASE)
    try:
        bien = conexion.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    except sqlite3.DatabaseError:
        bien = False
    finally:
        conexion.close()
    if not bien:
        raise HTTPException(422, DANADO)


def _conservar_acceso(restaurada: Path, viva: Path) -> None:
    conexion = sqlite3.connect(restaurada)
    try:
        conexion.execute("ATTACH DATABASE ? AS viva", (str(viva),))
        with conexion:
            conexion.execute("DELETE FROM sesion")
            conexion.execute("DELETE FROM usuario")
            conexion.execute("INSERT INTO usuario SELECT * FROM viva.usuario")
            conexion.execute("INSERT INTO sesion SELECT * FROM viva.sesion")
        conexion.execute("DETACH DATABASE viva")
    finally:
        conexion.close()


class RespaldoSalida(BaseModel):
    nombre: str
    fecha: FechaUTC
    motivo: str
    tamano: int


class Respaldos(BaseModel):
    carpeta: str
    atrasado: bool
    respaldos: list[RespaldoSalida]


def _salida(r: Respaldo) -> RespaldoSalida:
    return RespaldoSalida(nombre=r.nombre, fecha=a_utc(r.momento), motivo=r.motivo, tamano=r.tamano)


def _carpeta_legible(carpeta: Path) -> str:
    try:
        return "~/" + carpeta.resolve().relative_to(Path.home()).as_posix()
    except ValueError:
        return carpeta.resolve().as_posix()


@router.get("")
def ver(request: Request) -> Respaldos:
    config: Config = request.app.state.config
    return Respaldos(
        carpeta=_carpeta_legible(config.backup_dir),
        atrasado=atrasado(config),
        respaldos=[_salida(r) for r in listar(config)],
    )


@router.post("", status_code=201)
def respaldar_ahora(request: Request) -> RespaldoSalida:
    config: Config = request.app.state.config
    respaldo = crear(config, "manual")
    podar(config)
    return _salida(respaldo)


@router.get("/{nombre}")
def descargar(nombre: str, request: Request) -> FileResponse:
    config: Config = request.app.state.config
    if not NOMBRE.match(nombre) or not (config.backup_dir / nombre).is_file():
        raise HTTPException(404, NO_EXISTE)
    return FileResponse(config.backup_dir / nombre, media_type="application/zip", filename=nombre)


@router.post("/{nombre}/restaurar")
def restaurar_ruta(nombre: str, request: Request, sesion: SesionDB) -> RespaldoSalida:
    app = request.app
    sesion.close()  # suelta su conexión para que la base se pueda reemplazar

    def al_cambiar_base(soltar: bool) -> None:
        if soltar:
            app.state.motor.dispose()
        else:
            app.state.motor = crear_motor(app.state.config)

    return _salida(restaurar(app.state.config, nombre, al_cambiar_base))
