import zipfile
from datetime import date, datetime

import pytest

from app import respaldos
from app.config import Config
from app.hora import BOGOTA
from tests.test_insumos import crear_insumo


def bogota(*partes) -> datetime:
    return datetime(*partes, tzinfo=BOGOTA)


def vacio(config: Config, nombre: str) -> None:
    (config.backup_dir / nombre).write_bytes(b"x")


def nombres(config: Config) -> list[str]:
    return [r.nombre for r in respaldos.listar(config)]


def test_crea_zip_con_base_y_fotos(autenticado, config_tmp):
    crear_insumo(autenticado)
    fotos = config_tmp.data_dir / "fotos"
    fotos.mkdir(exist_ok=True)
    (fotos / "0123456789abcdef.webp").write_bytes(b"foto")
    r = respaldos.crear(config_tmp, "manual", ahora=bogota(2026, 11, 25, 15, 4, 5))
    assert r.nombre == "lya-2026-11-25-150405-manual.zip" and r.motivo == "manual"
    with zipfile.ZipFile(config_tmp.backup_dir / r.nombre) as z:
        assert sorted(z.namelist()) == ["fotos/0123456789abcdef.webp", "lya.db"]
    # No quedan archivos a medio hacer.
    assert [p.name for p in config_tmp.backup_dir.iterdir()] == [r.nombre]


def test_listar_ignora_otros_archivos(config_tmp):
    vacio(config_tmp, "lya-2026-11-20-210000.zip")
    vacio(config_tmp, "lya-2026-11-24-210000.zip")
    vacio(config_tmp, "otra-cosa.zip")
    vacio(config_tmp, "lya-2026-13-40-210000.zip")
    assert nombres(config_tmp) == ["lya-2026-11-24-210000.zip", "lya-2026-11-20-210000.zip"]


@pytest.mark.parametrize(
    ("ultimo", "ahora", "toca"),
    [
        (None, bogota(2026, 11, 25, 10), True),
        ("lya-2026-11-24-210500.zip", bogota(2026, 11, 25, 10), False),
        ("lya-2026-11-24-210500.zip", bogota(2026, 11, 25, 21, 1), True),
        ("lya-2026-11-25-210500.zip", bogota(2026, 11, 25, 23), False),
        # La Mac estuvo apagada a las 9:00 p. m. de anoche: se respalda al prender.
        ("lya-2026-11-23-210500.zip", bogota(2026, 11, 25, 8), True),
    ],
)
def test_toca_respaldar(config_tmp, ultimo, ahora, toca):
    if ultimo:
        vacio(config_tmp, ultimo)
    assert respaldos.toca_respaldar(config_tmp, ahora) is toca


def test_atrasado_despues_de_dos_dias(config_tmp):
    assert respaldos.atrasado(config_tmp, bogota(2026, 11, 25, 10))
    vacio(config_tmp, "lya-2026-11-23-210000.zip")
    assert not respaldos.atrasado(config_tmp, bogota(2026, 11, 25, 20))
    assert respaldos.atrasado(config_tmp, bogota(2026, 11, 25, 22))


def test_podar_deja_30_dias_y_uno_por_mes_un_ano(config_tmp):
    for nombre in [
        "lya-2026-11-25-210000.zip",
        "lya-2026-11-25-100000-manual.zip",
        "lya-2026-10-27-210000.zip",  # hace 29 días
        "lya-2026-10-20-210000.zip",  # el más reciente de octubre fuera de los 30 días
        "lya-2026-10-19-210000.zip",
        "lya-2026-09-30-210000.zip",
        "lya-2026-09-01-210000.zip",
        "lya-2025-11-30-210000.zip",  # hace 12 meses
        "lya-2025-10-31-210000.zip",  # más de un año
    ]:
        vacio(config_tmp, nombre)
    borrados = respaldos.podar(config_tmp, hoy=date(2026, 11, 25))
    assert sorted(borrados) == [
        "lya-2025-10-31-210000.zip",
        "lya-2026-09-01-210000.zip",
        "lya-2026-10-19-210000.zip",
    ]
    assert len(nombres(config_tmp)) == 6


def test_api_respaldar_listar_y_descargar(autenticado, config_tmp):
    r = autenticado.post("/api/respaldos")
    assert r.status_code == 201 and r.json()["motivo"] == "manual"
    lista = autenticado.get("/api/respaldos").json()
    assert lista["atrasado"] is False
    assert [x["nombre"] for x in lista["respaldos"]] == [r.json()["nombre"]]
    archivo = autenticado.get(f"/api/respaldos/{r.json()['nombre']}")
    assert archivo.status_code == 200 and archivo.content[:2] == b"PK"
    assert autenticado.get("/api/respaldos/..%2Flya.db").status_code == 404
    assert autenticado.get("/api/respaldos/lya-2026-01-01-000000.zip").status_code == 404


def test_api_pide_sesion(cliente):
    assert cliente.get("/api/respaldos").status_code == 401
    assert cliente.post("/api/respaldos").status_code == 401


def test_restaurar_vuelve_los_datos_y_conserva_la_sesion(autenticado, config_tmp):
    crear_insumo(autenticado, nombre="Hilo de antes")
    fotos = config_tmp.data_dir / "fotos"
    fotos.mkdir(exist_ok=True)
    (fotos / "aaaaaaaaaaaaaaaa.webp").write_bytes(b"vieja")
    respaldo = autenticado.post("/api/respaldos").json()["nombre"]

    crear_insumo(autenticado, nombre="Hilo de después")
    (fotos / "bbbbbbbbbbbbbbbb.webp").write_bytes(b"nueva")
    # Entró de nuevo después del respaldo: esa sesión no existe en el respaldo y debe seguir.
    entrar = {"usuario": "laura", "contrasena": "tejidos2026"}
    assert autenticado.post("/api/auth/entrar", json=entrar).status_code == 204

    r = autenticado.post(f"/api/respaldos/{respaldo}/restaurar")
    assert r.status_code == 200 and r.json()["motivo"] == "antes-de-restaurar"

    assert autenticado.get("/api/auth/yo").status_code == 200
    insumos = autenticado.get("/api/inventario/insumos").json()
    assert [i["nombre"] for i in insumos] == ["Hilo de antes"]
    assert sorted(p.name for p in fotos.iterdir()) == ["aaaaaaaaaaaaaaaa.webp"]
    # Lo de antes de restaurar quedó guardado y se puede volver a ello.
    previo = r.json()["nombre"]
    assert autenticado.post(f"/api/respaldos/{previo}/restaurar").status_code == 200
    insumos = autenticado.get("/api/inventario/insumos").json()
    assert sorted(i["nombre"] for i in insumos) == ["Hilo de antes", "Hilo de después"]


def test_restaurar_respaldo_danado_no_toca_nada(autenticado, config_tmp):
    crear_insumo(autenticado, nombre="Hilo")
    vacio(config_tmp, "lya-2026-11-20-210000.zip")
    r = autenticado.post("/api/respaldos/lya-2026-11-20-210000.zip/restaurar")
    assert r.status_code == 422 and r.json()["detail"] == respaldos.DANADO
    assert [i["nombre"] for i in autenticado.get("/api/inventario/insumos").json()] == ["Hilo"]
    assert autenticado.post("/api/respaldos/no-existe.zip/restaurar").status_code == 404


def test_restaurar_ignora_rutas_raras_del_zip(autenticado, config_tmp):
    bueno = autenticado.post("/api/respaldos").json()["nombre"]
    archivo = config_tmp.backup_dir / bueno
    with zipfile.ZipFile(archivo, "a") as z:
        z.writestr("../fuera.txt", "x")
        z.writestr("fotos/../../fuera2.txt", "x")
    assert autenticado.post(f"/api/respaldos/{bueno}/restaurar").status_code == 200
    assert not (config_tmp.data_dir.parent / "fuera.txt").exists()
    assert not (config_tmp.data_dir.parent / "fuera2.txt").exists()


def test_el_servicio_respalda_solo_al_arrancar_si_toca(tmp_path, monkeypatch):
    import time

    from fastapi.testclient import TestClient

    from app.db import migrar
    from app.principal import crear_app

    config = Config.desde_entorno(
        {
            "DATA_DIR": str(tmp_path / "d"),
            "BACKUP_DIR": str(tmp_path / "r"),
            "WEB_DIR": str(tmp_path),
        }
    )
    migrar(config)
    with TestClient(crear_app(config)):
        for _ in range(50):
            if respaldos.listar(config):
                break
            time.sleep(0.1)
    assert [r.motivo for r in respaldos.listar(config)] == ["diario"]
