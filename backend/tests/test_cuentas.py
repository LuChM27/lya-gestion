from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.cuentas.saldos import mes_utc, saldos
from app.db import crear_motor
from app.ventas.modelos import Transaccion
from tests.test_ventas import NEQUI, item, vender, vitrina  # noqa: F401

EFECTIVO = 1


def saldo_de(c, cuenta_id: int, archivadas: bool = False) -> int:
    lista = c.get("/api/cuentas/saldos", params={"archivadas": archivadas}).json()
    return next(x["saldo"] for x in lista if x["id"] == cuenta_id)


def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/cuentas/saldos").status_code == 401
    assert cliente.get("/api/categorias").status_code == 401


def test_categorias_sembradas(autenticado):
    gastos = autenticado.get("/api/categorias", params={"tipo": "gasto"}).json()
    assert [c["nombre"] for c in gastos] == [
        "Empaques",
        "Envíos",
        "Insumos",
        "Otros gastos",
        "Publicidad",
        "Servicios",
        "Stand de feria",
        "Transporte",
    ]
    todas = {c["nombre"]: c for c in autenticado.get("/api/categorias").json()}
    assert todas["Retiro personal"]["tipo"] == "retiro"
    assert todas["Otros ingresos"]["tipo"] == "ingreso"
    for nombre in ("Retiro personal", "Ventas", "Insumos"):
        assert todas[nombre]["protegida"] is True
    assert todas["Publicidad"]["protegida"] is False


def test_saldo_inicial_y_ventas(autenticado, vitrina):  # noqa: F811
    vender(autenticado, [item(vitrina["rosa"])])
    assert saldo_de(autenticado, NEQUI) == 125000
    r = autenticado.put(f"/api/cuentas/{NEQUI}", json={"nombre": "Nequi", "saldo_inicial": 50000})
    assert r.status_code == 200
    assert r.json()["saldo"] == 175000


def test_crear_cuenta_y_repetida(autenticado):
    r = autenticado.post("/api/cuentas", json={"nombre": "Bancolombia", "saldo_inicial": 300000})
    assert r.status_code == 201
    assert r.json()["saldo"] == 300000
    assert "Bancolombia" in [c["nombre"] for c in autenticado.get("/api/cuentas").json()]
    r = autenticado.post("/api/cuentas", json={"nombre": "bancolombia"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya tienes una cuenta llamada bancolombia."


def test_archivar_cuenta_con_saldo(autenticado, vitrina):  # noqa: F811
    vender(autenticado, [item(vitrina["rosa"])])
    assert autenticado.delete(f"/api/cuentas/{NEQUI}").status_code == 204
    assert "Nequi" not in [c["nombre"] for c in autenticado.get("/api/cuentas").json()]
    assert NEQUI not in [c["id"] for c in autenticado.get("/api/cuentas/saldos").json()]
    assert saldo_de(autenticado, NEQUI, archivadas=True) == 125000
    r = autenticado.post(f"/api/cuentas/{NEQUI}/restaurar")
    assert r.status_code == 200
    assert r.json()["activa"] is True


def test_categoria_nueva_y_protegida(autenticado):
    r = autenticado.post("/api/categorias", json={"nombre": "Clases", "tipo": "gasto"})
    assert r.status_code == 201
    clases = r.json()
    todas = {c["nombre"]: c for c in autenticado.get("/api/categorias").json()}
    r = autenticado.delete(f"/api/categorias/{todas['Insumos']['id']}")
    assert r.status_code == 409
    assert r.json()["detail"] == "La app usa esta categoría: no se puede archivar."
    assert autenticado.delete(f"/api/categorias/{clases['id']}").status_code == 204
    r = autenticado.post("/api/categorias", json={"nombre": "Otro", "tipo": "retiro"})
    assert r.status_code == 422
    r = autenticado.post("/api/categorias", json={"nombre": "publicidad", "tipo": "gasto"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya tienes una categoría llamada publicidad."


def test_saldo_hasta_una_fecha(autenticado, config_tmp):
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        for fecha, monto in ((datetime(2026, 10, 10), 1000), (datetime(2026, 11, 10), 500)):
            s.add(
                Transaccion(
                    fecha=fecha, tipo="ingreso", monto=monto, descripcion="x", cuenta_id=EFECTIVO
                )
            )
        s.commit()
        assert saldos(s, datetime(2026, 11, 1))[EFECTIVO] == 1000
        assert saldos(s)[EFECTIVO] == 1500
    motor.dispose()


def test_mes_utc():
    assert mes_utc("2026-11") == (datetime(2026, 11, 1, 5), datetime(2026, 12, 1, 5))
    assert mes_utc("2026-12")[1] == datetime(2027, 1, 1, 5)
    with pytest.raises(HTTPException) as e:
        mes_utc("2026-13")
    assert e.value.status_code == 422
