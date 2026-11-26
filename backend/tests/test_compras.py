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
    hace_dos = (hoy_bogota() - timedelta(days=2)).isoformat()
    compra = comprar(autenticado, insumos, cuenta_id=None, fecha=hace_dos).json()
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


def test_dos_pagos_a_la_vez_dejan_un_solo_egreso(autenticado, insumos, config_tmp):
    """Dos equipos pagan la misma compra al mismo tiempo: uno gana y el otro recibe 409."""
    import threading

    from fastapi import HTTPException
    from sqlalchemy.orm import Session

    from app.compras.compras import pagar
    from app.compras.esquemas import PagoCompra
    from app.db import crear_motor

    compra = comprar(autenticado, insumos, cuenta_id=None).json()
    motor = crear_motor(config_tmp)
    errores: list[int] = []

    def segundo():
        with Session(motor) as s2:
            try:
                pagar(compra["id"], PagoCompra(cuenta_id=NEQUI), s2)
            except HTTPException as error:
                errores.append(error.status_code)

    with Session(motor) as s1:
        commit = s1.commit
        hilo = threading.Thread(target=segundo)

        def commit_tardio():
            # El primero ya marcó la compra pero aún no confirma: el segundo entra ahora.
            hilo.start()
            hilo.join(0.5)
            commit()

        s1.commit = commit_tardio
        pagar(compra["id"], PagoCompra(cuenta_id=EFECTIVO), s1)
    hilo.join()
    motor.dispose()
    assert errores == [409]
    assert contar(config_tmp, Transaccion) == 1
    assert autenticado.get(f"/api/compras/{compra['id']}").json()["cuenta"]["nombre"] == "Efectivo"


def test_lista_de_compras_no_consulta_por_cada_compra(autenticado, insumos, config_tmp):
    from sqlalchemy import event
    from sqlalchemy.orm import Session

    from app.compras.compras import listar
    from app.db import crear_motor

    for _ in range(5):
        comprar(autenticado, insumos)
    comprar(autenticado, insumos, cuenta_id=None)
    motor = crear_motor(config_tmp)
    consultas: list[str] = []
    event.listen(motor, "before_cursor_execute", lambda *a: consultas.append(a[2]))
    with Session(motor) as s:
        compras = listar(s)
    motor.dispose()
    assert len(compras) == 6
    assert len(consultas) <= 4
    assert sum(c["cuenta"] is None for c in (x.model_dump() for x in compras)) == 1
    assert all(len(c.items) == 2 for c in compras)


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


def test_anular_con_otra_compra_al_mismo_precio(autenticado, insumos):
    hilo = insumos["hilo"]
    solo = [{"insumo_id": hilo, "cantidad": 10, "precio_unitario": 100}]
    a = comprar(autenticado, insumos, items=solo).json()
    comprar(autenticado, insumos, items=solo)
    autenticado.post(f"/api/compras/{a['id']}/anular")
    assert insumo(autenticado, hilo)["precio_unitario"] == 100


def test_pago_no_antes_de_la_compra(autenticado, insumos):
    hoy = hoy_bogota()
    compra = comprar(
        autenticado, insumos, cuenta_id=None, fecha=(hoy - timedelta(days=1)).isoformat()
    ).json()
    r = autenticado.post(
        f"/api/compras/{compra['id']}/pago",
        json={"cuenta_id": EFECTIVO, "fecha": (hoy - timedelta(days=3)).isoformat()},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "El pago no puede ser de antes de la compra."
