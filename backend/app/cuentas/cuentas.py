"""Cuentas de dinero con su saldo calculado y categorías de ingreso, gasto y retiro."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.cuentas.esquemas import (
    CategoriaEntrada,
    CategoriaNombre,
    CategoriaSalida,
    CuentaEntrada,
    CuentaSaldo,
)
from app.cuentas.saldos import saldos
from app.db import SesionDB
from app.inventario.productos import sin_tildes
from app.ventas.modelos import Categoria, Cuenta

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])

# La app las usa por nombre: ventas, compras y retiros.
PROTEGIDAS = frozenset({"Ventas", "Insumos", "Retiro personal"})


def _cuenta(sesion: Session, cuenta_id: int) -> Cuenta:
    cuenta = sesion.get(Cuenta, cuenta_id)
    if cuenta is None:
        raise HTTPException(404, "Esa cuenta no existe.")
    return cuenta


def _salida(sesion: Session, cuenta: Cuenta) -> CuentaSaldo:
    return CuentaSaldo(
        id=cuenta.id,
        nombre=cuenta.nombre,
        saldo_inicial=cuenta.saldo_inicial,
        saldo=saldos(sesion)[cuenta.id],
        activa=cuenta.activa,
    )


def _revisar_nombre(sesion: Session, modelo, nombre: str, propio: int | None, texto: str) -> None:
    # SQLite no pasa a minúsculas las letras con tilde: se compara en Python.
    for otro in sesion.scalars(select(modelo).where(modelo.id != (propio or 0))):
        if sin_tildes(otro.nombre) == sin_tildes(nombre):
            raise HTTPException(409, f"Ya tienes {texto} llamada {nombre}.")


@router.get("/cuentas/saldos")
def listar_saldos(sesion: SesionDB, archivadas: bool = False) -> list[CuentaSaldo]:
    todos = saldos(sesion)
    cuentas = sesion.scalars(
        select(Cuenta).where(Cuenta.activa.is_(not archivadas)).order_by(Cuenta.id)
    )
    return [
        CuentaSaldo(
            id=c.id,
            nombre=c.nombre,
            saldo_inicial=c.saldo_inicial,
            saldo=todos[c.id],
            activa=c.activa,
        )
        for c in cuentas
    ]


@router.post("/cuentas", status_code=201)
def crear_cuenta(datos: CuentaEntrada, sesion: SesionDB) -> CuentaSaldo:
    _revisar_nombre(sesion, Cuenta, datos.nombre, None, "una cuenta")
    cuenta = Cuenta(nombre=datos.nombre, saldo_inicial=datos.saldo_inicial, activa=True)
    sesion.add(cuenta)
    sesion.commit()
    return _salida(sesion, cuenta)


@router.put("/cuentas/{cuenta_id}")
def editar_cuenta(cuenta_id: int, datos: CuentaEntrada, sesion: SesionDB) -> CuentaSaldo:
    cuenta = _cuenta(sesion, cuenta_id)
    _revisar_nombre(sesion, Cuenta, datos.nombre, cuenta.id, "una cuenta")
    cuenta.nombre = datos.nombre
    cuenta.saldo_inicial = datos.saldo_inicial
    sesion.commit()
    return _salida(sesion, cuenta)


@router.delete("/cuentas/{cuenta_id}", status_code=204)
def archivar_cuenta(cuenta_id: int, sesion: SesionDB) -> None:
    _cuenta(sesion, cuenta_id).activa = False
    sesion.commit()


@router.post("/cuentas/{cuenta_id}/restaurar")
def restaurar_cuenta(cuenta_id: int, sesion: SesionDB) -> CuentaSaldo:
    cuenta = _cuenta(sesion, cuenta_id)
    cuenta.activa = True
    sesion.commit()
    return _salida(sesion, cuenta)


def _categoria_salida(c: Categoria) -> CategoriaSalida:
    return CategoriaSalida(
        id=c.id, nombre=c.nombre, tipo=c.tipo, activa=c.activa, protegida=c.nombre in PROTEGIDAS
    )


def _categoria(sesion: Session, categoria_id: int) -> Categoria:
    categoria = sesion.get(Categoria, categoria_id)
    if categoria is None:
        raise HTTPException(404, "Esa categoría no existe.")
    return categoria


@router.get("/categorias")
def listar_categorias(
    sesion: SesionDB, tipo: str = "", archivadas: bool = False
) -> list[CategoriaSalida]:
    consulta = select(Categoria).where(Categoria.activa.is_(not archivadas))
    if tipo:
        consulta = consulta.where(Categoria.tipo == tipo)
    categorias = sorted(sesion.scalars(consulta), key=lambda c: sin_tildes(c.nombre))
    return [_categoria_salida(c) for c in categorias]


@router.post("/categorias", status_code=201)
def crear_categoria(datos: CategoriaEntrada, sesion: SesionDB) -> CategoriaSalida:
    _revisar_nombre(sesion, Categoria, datos.nombre, None, "una categoría")
    categoria = Categoria(nombre=datos.nombre, tipo=datos.tipo, activa=True)
    sesion.add(categoria)
    sesion.commit()
    return _categoria_salida(categoria)


@router.put("/categorias/{categoria_id}")
def renombrar_categoria(
    categoria_id: int, datos: CategoriaNombre, sesion: SesionDB
) -> CategoriaSalida:
    categoria = _categoria(sesion, categoria_id)
    if categoria.nombre in PROTEGIDAS:
        raise HTTPException(409, "La app usa esta categoría: no se puede renombrar.")
    _revisar_nombre(sesion, Categoria, datos.nombre, categoria.id, "una categoría")
    categoria.nombre = datos.nombre
    sesion.commit()
    return _categoria_salida(categoria)


@router.delete("/categorias/{categoria_id}", status_code=204)
def archivar_categoria(categoria_id: int, sesion: SesionDB) -> None:
    categoria = _categoria(sesion, categoria_id)
    if categoria.nombre in PROTEGIDAS:
        raise HTTPException(409, "La app usa esta categoría: no se puede archivar.")
    categoria.activa = False
    sesion.commit()


@router.post("/categorias/{categoria_id}/restaurar")
def restaurar_categoria(categoria_id: int, sesion: SesionDB) -> CategoriaSalida:
    categoria = _categoria(sesion, categoria_id)
    categoria.activa = True
    sesion.commit()
    return _categoria_salida(categoria)
