from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import crear_motor
from app.hora import hoy_bogota
from app.principal import DATO_INVALIDO
from app.ventas.modelos import Pago, Pedido, PedidoItem, Transaccion
from tests.test_productos import crear_modelo, crear_variante, mover

NEQUI = 2


@pytest.fixture
def vitrina(autenticado) -> dict:
    m = crear_modelo(autenticado, nombre="Bolso balde", precio_venta=125000, horas_tejido=6)
    rosa = crear_variante(autenticado, m["id"], color="Rosa palo")
    negro = crear_variante(autenticado, m["id"], color="Negro")
    mover(autenticado, rosa["id"], "ingreso_vitrina", 3)
    mover(autenticado, negro["id"], "ingreso_vitrina", 1)
    return {"modelo": m, "rosa": rosa["id"], "negro": negro["id"]}


def vender(c, items, **datos):
    cuerpo = {"canal": "instagram", "cuenta_id": NEQUI, "items": items} | datos
    return c.post("/api/ventas", json=cuerpo)


def item(variante_id: int, cantidad: int = 1) -> dict:
    return {"variante_id": variante_id, "cantidad": cantidad}


def existencia_de(c, modelo_id: int, variante_id: int):
    m = c.get(f"/api/inventario/modelos/{modelo_id}").json()
    return next(v["existencia"] for v in m["variantes"] if v["id"] == variante_id)


def contar(config, modelo) -> int:
    motor = crear_motor(config)
    with Session(motor) as s:
        n = s.scalar(select(func.count()).select_from(modelo))
    motor.dispose()
    return n


def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/ventas/catalogo").status_code == 401
    assert cliente.post("/api/ventas", json={}).status_code == 401


def test_cuentas_iniciales(autenticado):
    r = autenticado.get("/api/cuentas")
    assert [c["nombre"] for c in r.json()] == ["Efectivo", "Nequi", "Daviplata"]


def test_catalogo_solo_lo_que_hay_en_vitrina(autenticado, vitrina):
    autenticado.delete(f"/api/inventario/variantes/{vitrina['negro']}")
    r = autenticado.get("/api/ventas/catalogo")
    assert r.status_code == 200
    assert [(i["color"], i["existencia"], i["precio"]) for i in r.json()] == [
        ("Rosa palo", 3, 125000)
    ]
    assert r.json()[0]["nombre"] == "Bolso balde"


def test_venta_descuenta_stock_y_suma_a_la_cuenta(autenticado, vitrina, config_tmp):
    r = vender(autenticado, [item(vitrina["rosa"], 2)], descuento=10000)
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["total"] == 240000 and v["subtotal"] == 250000 and v["descuento"] == 10000
    assert len(v["numero"]) == 4 and v["numero"] == f"{v['id']:04d}"
    assert v["estado"] == "entregado" and v["cliente"] == "Cliente de mostrador"
    assert v["cuenta"] == {"id": NEQUI, "nombre": "Nequi"}
    assert v["items"] == [
        {
            "variante_id": vitrina["rosa"],
            "modelo": "Bolso balde",
            "color": "Rosa palo",
            "cantidad": 2,
            "precio_unitario": 125000,
            "subtotal": 250000,
        }
    ]
    assert v["comprobante"].startswith(f"/api/pedidos/{v['id']}/comprobante.pdf?v=")
    assert existencia_de(autenticado, vitrina["modelo"]["id"], vitrina["rosa"]) == 1
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        t = s.scalars(select(Transaccion)).one()
        assert (t.tipo, t.monto, t.cuenta_id) == ("ingreso", 240000, NEQUI)
        assert t.descripcion == f"Venta N.º {v['numero']}"
        assert s.scalars(select(PedidoItem)).one().costo_unitario == 60000
    motor.dispose()


def test_venta_sin_stock_no_deja_nada(autenticado, vitrina, config_tmp):
    r = vender(autenticado, [item(vitrina["rosa"]), item(vitrina["negro"], 2)])
    assert r.status_code == 422
    assert r.json()["detail"] == "Solo hay 1 de Bolso balde Negro."
    for modelo in (Pedido, PedidoItem, Pago, Transaccion):
        assert contar(config_tmp, modelo) == 0
    assert existencia_de(autenticado, vitrina["modelo"]["id"], vitrina["rosa"]) == 3


def test_misma_variante_dos_veces_se_suma(autenticado, vitrina):
    r = vender(autenticado, [item(vitrina["rosa"], 2), item(vitrina["rosa"], 2)])
    assert r.status_code == 422
    assert r.json()["detail"] == "Solo hay 3 de Bolso balde Rosa palo."


def test_descuento_mayor_que_subtotal_da_422(autenticado, vitrina):
    r = vender(autenticado, [item(vitrina["rosa"])], descuento=125001)
    assert r.status_code == 422
    assert r.json()["detail"] == "El descuento no puede ser mayor que el subtotal."


def test_regalo_sin_pago(autenticado, vitrina, config_tmp):
    r = vender(autenticado, [item(vitrina["rosa"])], descuento=125000)
    assert r.status_code == 201
    assert r.json()["total"] == 0 and r.json()["cuenta"] is None
    assert contar(config_tmp, Transaccion) == 0 and contar(config_tmp, Pago) == 0


def test_variante_archivada_da_422(autenticado, vitrina):
    autenticado.delete(f"/api/inventario/variantes/{vitrina['negro']}")
    r = vender(autenticado, [item(vitrina["negro"])])
    assert r.status_code == 422
    assert r.json()["detail"] == "Bolso balde Negro está archivado."


def test_variante_inexistente_da_404(autenticado, vitrina):
    r = vender(autenticado, [item(999)])
    assert r.status_code == 404 and r.json()["detail"] == "Ese producto no existe."


@pytest.mark.parametrize("cuenta_id", [999, "inactiva"])
def test_cuenta_inactiva_da_422(autenticado, vitrina, config_tmp, cuenta_id):
    if cuenta_id == "inactiva":
        from app.ventas.modelos import Cuenta

        motor = crear_motor(config_tmp)
        with Session(motor) as s:
            s.get(Cuenta, NEQUI).activa = False
            s.commit()
        motor.dispose()
        cuenta_id = NEQUI
    r = vender(autenticado, [item(vitrina["rosa"])], cuenta_id=cuenta_id)
    assert r.status_code == 422
    assert r.json()["detail"] == "Elige la cuenta donde entró el dinero."


def test_fecha_futura_da_422(autenticado, vitrina):
    manana = (hoy_bogota() + timedelta(days=1)).isoformat()
    r = vender(autenticado, [item(vitrina["rosa"])], fecha=manana)
    assert r.status_code == 422 and r.json()["detail"] == "La fecha no puede ser futura."


def test_venta_de_ayer(autenticado, vitrina, config_tmp):
    ayer = hoy_bogota() - timedelta(days=1)
    r = vender(autenticado, [item(vitrina["rosa"])], fecha=ayer.isoformat())
    assert r.status_code == 201
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        fecha = s.get(Pedido, r.json()["id"]).fecha
    motor.dispose()
    assert (fecha.date(), fecha.hour, fecha.minute) == (ayer, 17, 0)


def test_canal_invalido_da_mensaje_en_espanol(autenticado, vitrina):
    r = vender(autenticado, [item(vitrina["rosa"])], canal="radio")
    assert r.status_code == 422 and r.json()["detail"] == DATO_INVALIDO


def test_ventas_del_dia_con_total(autenticado, vitrina):
    a = vender(autenticado, [item(vitrina["rosa"])]).json()
    b = vender(autenticado, [item(vitrina["rosa"])], descuento=5000).json()
    c = vender(autenticado, [item(vitrina["negro"])]).json()
    assert autenticado.post(f"/api/ventas/{c['id']}/anular").status_code == 200
    r = autenticado.get("/api/ventas")
    assert r.status_code == 200
    dia = r.json()
    assert dia["dia"] == hoy_bogota().isoformat()
    assert dia["cantidad"] == 2 and dia["total"] == a["total"] + b["total"]
    assert [v["id"] for v in dia["ventas"]] == [c["id"], b["id"], a["id"]]


def test_venta_de_la_noche_cuenta_en_su_dia(autenticado, vitrina, config_tmp):
    from datetime import datetime

    v = vender(autenticado, [item(vitrina["rosa"])]).json()
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        s.get(Pedido, v["id"]).fecha = datetime(2026, 10, 30, 1, 0)
        s.commit()
    motor.dispose()
    del_29 = autenticado.get("/api/ventas?dia=2026-10-29").json()
    del_30 = autenticado.get("/api/ventas?dia=2026-10-30").json()
    assert [x["id"] for x in del_29["ventas"]] == [v["id"]]
    assert del_30["ventas"] == []


def test_anular_devuelve_stock_y_quita_el_ingreso(autenticado, vitrina, config_tmp):
    v = vender(autenticado, [item(vitrina["rosa"], 2)]).json()
    r = autenticado.post(f"/api/ventas/{v['id']}/anular")
    assert r.status_code == 200
    anulada = r.json()
    assert anulada["estado"] == "cancelado"
    assert anulada["comprobante"] != v["comprobante"]
    assert existencia_de(autenticado, vitrina["modelo"]["id"], vitrina["rosa"]) == 3
    assert contar(config_tmp, Transaccion) == 0 and contar(config_tmp, Pago) == 0
    assert autenticado.get(f"/api/ventas/{v['id']}").json()["estado"] == "cancelado"


def test_anular_dos_veces_da_409(autenticado, vitrina):
    v = vender(autenticado, [item(vitrina["rosa"])]).json()
    autenticado.post(f"/api/ventas/{v['id']}/anular")
    r = autenticado.post(f"/api/ventas/{v['id']}/anular")
    assert r.status_code == 409 and r.json()["detail"] == "Esta venta ya está anulada."


def test_venta_inexistente_da_404(autenticado):
    r = autenticado.get("/api/ventas/999")
    assert r.status_code == 404 and r.json()["detail"] == "Esa venta no existe."
    assert autenticado.post("/api/ventas/999/anular").status_code == 404


def test_dos_anulaciones_a_la_vez_devuelven_una_sola_vez(autenticado, vitrina, config_tmp):
    import threading

    from fastapi import HTTPException

    from app.ventas.ventas import anular_venta

    v = vender(autenticado, [item(vitrina["rosa"], 2)]).json()
    motor = crear_motor(config_tmp)
    errores: list[Exception] = []

    def segunda():
        with Session(motor) as s2:
            try:
                anular_venta(s2, s2.get(Pedido, v["id"]))
                s2.commit()
            except HTTPException as error:
                errores.append(error)

    with Session(motor) as s1:
        anular_venta(s1, s1.get(Pedido, v["id"]))
        hilo = threading.Thread(target=segunda)
        hilo.start()
        hilo.join(0.5)  # la segunda ya leyó el pedido o está esperando para escribir
        s1.commit()
    hilo.join()
    motor.dispose()
    assert [e.status_code for e in errores] == [409]
    assert existencia_de(autenticado, vitrina["modelo"]["id"], vitrina["rosa"]) == 3


def test_venta_de_ayer_lleva_su_fecha_al_dinero_y_al_stock(autenticado, vitrina, config_tmp):
    from app.inventario.modelos import MovimientoInventario

    ayer = hoy_bogota() - timedelta(days=1)
    v = vender(autenticado, [item(vitrina["rosa"])], fecha=ayer.isoformat()).json()
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        fecha = s.get(Pedido, v["id"]).fecha
        assert s.scalars(select(Pago.fecha)).one() == fecha
        assert s.scalars(select(Transaccion.fecha)).one() == fecha
        venta = select(MovimientoInventario.fecha).where(MovimientoInventario.pedido_id == v["id"])
        assert s.scalars(venta).one() == fecha
    motor.dispose()


def test_anulada_conserva_la_cuenta(autenticado, vitrina):
    v = vender(autenticado, [item(vitrina["rosa"])]).json()
    anulada = autenticado.post(f"/api/ventas/{v['id']}/anular").json()
    assert anulada["cuenta"] == {"id": NEQUI, "nombre": "Nequi"}
    dia = autenticado.get("/api/ventas").json()
    assert dia["ventas"][0]["cuenta"]["nombre"] == "Nequi"


def test_anular_registra_movimiento_de_anulacion(autenticado, vitrina):
    v = vender(autenticado, [item(vitrina["rosa"])]).json()
    autenticado.post(f"/api/ventas/{v['id']}/anular")
    tipos = [
        m["tipo"]
        for m in autenticado.get(f"/api/inventario/variantes/{vitrina['rosa']}/movimientos").json()
    ]
    assert tipos[:2] == ["anulacion", "venta"]
    assert "devolucion" not in tipos
