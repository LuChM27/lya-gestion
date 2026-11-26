from datetime import timedelta

import pytest

from app.compras.modelos import Compra
from app.hora import hoy_bogota
from app.ventas.modelos import Transaccion
from tests.test_cuentas import EFECTIVO, saldo_de
from tests.test_insumos import crear_insumo, entrada
from tests.test_movimientos import lista
from tests.test_ventas import NEQUI, contar


@pytest.fixture
def insumos(autenticado) -> dict:
    hilo = crear_insumo(autenticado, unidad_compra="cono", factor_compra=400, precio_unitario=40)
    argollas = crear_insumo(
        autenticado, nombre="Argollas doradas", tipo="argolla", unidad="unidades"
    )
    return {"hilo": hilo["id"], "argollas": argollas["id"]}


def comprar(c, insumos, **datos):
    cuerpo = {
        "proveedor": "Hilos La 14",
        "cuenta_id": NEQUI,
        "items": [
            {
                "insumo_id": insumos["hilo"],
                "cantidad": 2,
                "en_unidad_compra": True,
                "precio_unitario": 18000,
            },
            {"insumo_id": insumos["argollas"], "cantidad": 20, "precio_unitario": 1500},
        ],
    } | datos
    return c.post("/api/compras", json=cuerpo)


def insumo(c, insumo_id):
    return c.get(f"/api/inventario/insumos/{insumo_id}").json()


def test_compra_pagada(autenticado, insumos):
    r = comprar(autenticado, insumos)
    assert r.status_code == 201, r.text
    compra = r.json()
    assert compra["total"] == 66000
    assert compra["numero"] == "0001"
    assert compra["cuenta"]["nombre"] == "Nequi"
    assert compra["items"][0] == {
        "insumo_id": insumos["hilo"],
        "insumo": "Hilo algodón rosa",
        "cantidad": 800,
        "unidad": "metros",
        "precio_unitario": 45,
        "subtotal": 36000,
    }
    hilo = insumo(autenticado, insumos["hilo"])
    assert hilo["existencia"] == 800
    assert hilo["precio_unitario"] == 45
    assert saldo_de(autenticado, NEQUI) == -66000
    m = lista(autenticado)[0]
    assert m["descripcion"] == "Compra N.º 0001 · Hilos La 14"
    assert m["categoria"] == "Insumos"
    assert m["origen"] == {"tipo": "compra", "id": compra["id"], "numero": "0001"}


def test_compra_sin_pagar_y_pago_despues(autenticado, insumos):
    compra = comprar(autenticado, insumos, cuenta_id=None).json()
    assert compra["cuenta"] is None
    assert saldo_de(autenticado, NEQUI) == 0
    sin_pagar = autenticado.get("/api/compras", params={"sin_pagar": True}).json()
    assert [c["id"] for c in sin_pagar] == [compra["id"]]
    ayer = (hoy_bogota() - timedelta(days=1)).isoformat()
    r = autenticado.post(
        f"/api/compras/{compra['id']}/pago", json={"cuenta_id": EFECTIVO, "fecha": ayer}
    )
    assert r.status_code == 200, r.text
    assert r.json()["cuenta"]["nombre"] == "Efectivo"
    assert saldo_de(autenticado, EFECTIVO) == -66000
    assert autenticado.get("/api/compras", params={"sin_pagar": True}).json() == []


def test_pagar_dos_veces(autenticado, insumos, config_tmp):
    compra = comprar(autenticado, insumos, cuenta_id=None).json()
    pagar = lambda: autenticado.post(
        f"/api/compras/{compra['id']}/pago", json={"cuenta_id": EFECTIVO}
    )
    assert pagar().status_code == 200
    r = pagar()
    assert r.status_code == 409
    assert r.json()["detail"] == "Esta compra ya está pagada."
    assert contar(config_tmp, Transaccion) == 1


def test_anular_compra(autenticado, insumos):
    hilo_id = insumos["hilo"]
    compra = comprar(autenticado, insumos).json()
    autenticado.post(
        f"/api/inventario/insumos/{hilo_id}/movimientos", json={"tipo": "merma", "cantidad": 300}
    )
    r = autenticado.post(f"/api/compras/{compra['id']}/anular")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "anulada"
    hilo = insumo(autenticado, hilo_id)
    assert hilo["existencia"] == -300
    assert hilo["precio_unitario"] == 40
    assert saldo_de(autenticado, NEQUI) == 0
    for r in (
        autenticado.post(f"/api/compras/{compra['id']}/anular"),
        autenticado.post(f"/api/compras/{compra['id']}/pago", json={"cuenta_id": EFECTIVO}),
    ):
        assert r.status_code == 409
        assert r.json()["detail"] == "Esta compra está anulada."


def test_compra_invalida(autenticado, insumos, config_tmp):
    assert comprar(autenticado, insumos, items=[]).status_code == 422
    # Con un movimiento, borrar lo archiva en vez de eliminarlo.
    entrada(autenticado, insumos["argollas"], cantidad=1)
    autenticado.delete(f"/api/inventario/insumos/{insumos['argollas']}")
    r = comprar(autenticado, insumos)
    assert r.status_code == 422
    assert r.json()["detail"] == "Argollas doradas está archivado."
    sin_unidad = [
        {"insumo_id": insumos["hilo"], "cantidad": 1, "precio_unitario": 1},
        {
            "insumo_id": crear_insumo(autenticado, nombre="Forro")["id"],
            "cantidad": 1,
            "en_unidad_compra": True,
            "precio_unitario": 1,
        },
    ]
    r = comprar(autenticado, insumos, items=sin_unidad)
    assert r.json()["detail"] == "Este insumo no tiene unidad de compra."
    autenticado.delete("/api/cuentas/3")
    solo_hilo = sin_unidad[:1]
    assert (
        comprar(autenticado, insumos, items=solo_hilo, cuenta_id=3).json()["detail"]
        == "Elige una cuenta."
    )
    manana = (hoy_bogota() + timedelta(days=1)).isoformat()
    assert comprar(autenticado, insumos, items=solo_hilo, fecha=manana).status_code == 422
    assert contar(config_tmp, Compra) == 0
    assert contar(config_tmp, Transaccion) == 0
    assert insumo(autenticado, insumos["hilo"])["existencia"] == 0


def test_proveedores_sugeridos(autenticado, insumos):
    comprar(autenticado, insumos)
    comprar(autenticado, insumos, proveedor="Murano Express")
    comprar(autenticado, insumos)
    assert autenticado.get("/api/compras/proveedores").json() == ["Hilos La 14", "Murano Express"]
