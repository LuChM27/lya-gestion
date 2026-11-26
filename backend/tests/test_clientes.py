from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import crear_motor
from app.ventas.modelos import Cliente, Pago, Pedido, PedidoItem
from tests.test_productos import crear_modelo, crear_variante


def crear_cliente(c, **datos):
    cuerpo = {"nombre": "Valentina Ríos", "whatsapp": "300 456 7812"} | datos
    return c.post("/api/clientes", json=cuerpo)


def id_mostrador(config) -> int:
    motor = crear_motor(config)
    with Session(motor) as s:
        n = s.scalar(select(Cliente.id).where(Cliente.es_mostrador))
    motor.dispose()
    return n


def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/clientes").status_code == 401


def test_crear_normaliza_whatsapp(autenticado):
    r = crear_cliente(autenticado, whatsapp="+57 300-456-7812")
    assert r.status_code == 201
    c = r.json()
    assert c["whatsapp"] == "573004567812"
    assert c["enlace_whatsapp"] == "https://wa.me/573004567812"
    assert c["activo"] is True
    assert c["compras"] == 0
    assert c["historial"] == []


def test_whatsapp_invalido(autenticado):
    for numero in ("12ab", "1234567890123456"):
        r = crear_cliente(autenticado, whatsapp=numero)
        assert r.status_code == 422
        assert r.json()["detail"] == "Escribe un WhatsApp válido."


def test_nombre_obligatorio(autenticado):
    assert crear_cliente(autenticado, nombre="   ").status_code == 422


def test_whatsapp_repetido_en_otro_formato(autenticado):
    crear_cliente(autenticado, whatsapp="3004567812")
    r = crear_cliente(autenticado, nombre="Otra", whatsapp="+57 300 456 7812")
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya tienes a Valentina Ríos con ese WhatsApp."


def test_whatsapp_de_archivada(autenticado):
    v = crear_cliente(autenticado).json()
    autenticado.delete(f"/api/clientes/{v['id']}")
    r = crear_cliente(autenticado, nombre="Otra")
    assert r.status_code == 409
    assert r.json()["detail"] == (
        "Valentina Ríos tiene ese WhatsApp y está archivada: recupérala en Clientes."
    )


def test_editar_puede_conservar_su_whatsapp(autenticado):
    v = crear_cliente(autenticado).json()
    s = crear_cliente(autenticado, nombre="Sofía Gómez", whatsapp="315 220 9087").json()
    r = autenticado.put(
        f"/api/clientes/{v['id']}",
        json={"nombre": "Valentina Ríos", "whatsapp": "3004567812", "ciudad": "Medellín"},
    )
    assert r.status_code == 200
    assert r.json()["ciudad"] == "Medellín"
    r = autenticado.put(
        f"/api/clientes/{s['id']}", json={"nombre": "Sofía Gómez", "whatsapp": "3004567812"}
    )
    assert r.status_code == 409


def test_buscar_sin_tildes_y_por_whatsapp(autenticado):
    crear_cliente(autenticado)
    crear_cliente(autenticado, nombre="Sofía Gómez", whatsapp="315 220 9087", instagram="@sofi.g")

    def nombres(buscar):
        r = autenticado.get("/api/clientes", params={"buscar": buscar})
        return [c["nombre"] for c in r.json()]

    assert nombres("valentina rios") == ["Valentina Ríos"]
    assert nombres("4567") == ["Valentina Ríos"]
    assert nombres("@sofi") == ["Sofía Gómez"]


def test_lista_ordenada_y_sin_mostrador(autenticado):
    crear_cliente(autenticado, nombre="Beatriz", whatsapp="3001111111")
    crear_cliente(autenticado, nombre="Ángela", whatsapp="3002222222")
    r = autenticado.get("/api/clientes")
    assert [c["nombre"] for c in r.json()] == ["Ángela", "Beatriz"]


def test_archivar_y_restaurar(autenticado):
    v = crear_cliente(autenticado).json()
    assert autenticado.delete(f"/api/clientes/{v['id']}").status_code == 204
    assert autenticado.get("/api/clientes").json() == []
    archivadas = autenticado.get("/api/clientes", params={"archivados": True}).json()
    assert [c["id"] for c in archivadas] == [v["id"]]
    r = autenticado.post(f"/api/clientes/{v['id']}/restaurar")
    assert r.status_code == 200
    assert r.json()["activo"] is True


def test_mostrador_no_se_toca(autenticado, config_tmp):
    m = id_mostrador(config_tmp)
    cuerpo = {"nombre": "X", "whatsapp": "3009999999"}
    for r in (
        autenticado.get(f"/api/clientes/{m}"),
        autenticado.put(f"/api/clientes/{m}", json=cuerpo),
        autenticado.delete(f"/api/clientes/{m}"),
    ):
        assert r.status_code == 404
        assert r.json()["detail"] == "Esa clienta no existe."


def pedido(
    config,
    cliente_id,
    total,
    canal="instagram",
    estado="entregado",
    pagado=None,
    dias_atras=0,
    variante_id=None,
):
    motor = crear_motor(config)
    with Session(motor) as s:
        p = Pedido(
            fecha=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=dias_atras),
            canal=canal,
            tipo="inmediata",
            estado=estado,
            cliente_id=cliente_id,
            total=total,
        )
        s.add(p)
        s.flush()
        if variante_id is not None:
            s.add(
                PedidoItem(
                    pedido_id=p.id, variante_id=variante_id, cantidad=1, precio_unitario=total
                )
            )
        monto = total if pagado is None else pagado
        if monto:
            s.add(Pago(pedido_id=p.id, cuenta_id=2, monto=monto))
        s.commit()
        n = p.id
    motor.dispose()
    return n


@pytest.fixture
def rosa(autenticado) -> int:
    m = crear_modelo(autenticado, nombre="Bolso balde", precio_venta=125000)
    return crear_variante(autenticado, m["id"], color="Rosa palo")["id"]


def test_ficha_con_compras(autenticado, config_tmp, rosa):
    v = crear_cliente(autenticado).json()
    pedido(config_tmp, v["id"], 125000, dias_atras=10, variante_id=rosa)
    pedido(config_tmp, v["id"], 98000, dias_atras=2)
    hoy = pedido(config_tmp, v["id"], 28000, canal="feria")
    f = autenticado.get(f"/api/clientes/{v['id']}").json()
    assert f["total_comprado"] == 251000
    assert f["compras"] == 3
    assert f["promedio"] == 83667
    assert f["canal_frecuente"] == "instagram"
    assert f["por_cobrar"] == 0
    assert f["historial"][0]["id"] == hoy
    assert f["ultima_compra"] == f["historial"][0]["fecha"]
    assert f["historial"][0]["numero"] == f"{hoy:04d}"
    assert [h["total"] for h in f["historial"]] == [28000, 98000, 125000]
    assert f["historial"][2]["productos"] == "Bolso balde · Rosa palo"


def test_ficha_no_cuenta_anuladas(autenticado, config_tmp):
    v = crear_cliente(autenticado).json()
    pedido(config_tmp, v["id"], 50000, estado="cancelado", pagado=0, dias_atras=1)
    pedido(config_tmp, v["id"], 30000)
    f = autenticado.get(f"/api/clientes/{v['id']}").json()
    assert f["total_comprado"] == 30000
    assert f["compras"] == 1
    assert f["promedio"] == 30000
    assert [h["estado"] for h in f["historial"]] == ["entregado", "cancelado"]


def test_por_cobrar(autenticado, config_tmp):
    v = crear_cliente(autenticado).json()
    pedido(config_tmp, v["id"], 200000, pagado=100000)
    pedido(config_tmp, v["id"], 80000, estado="cancelado", pagado=0)
    assert autenticado.get(f"/api/clientes/{v['id']}").json()["por_cobrar"] == 100000


def test_lista_trae_total_comprado(autenticado, config_tmp):
    v = crear_cliente(autenticado).json()
    pedido(config_tmp, v["id"], 125000)
    pedido(config_tmp, v["id"], 40000, estado="cancelado", pagado=0)
    lista = autenticado.get("/api/clientes").json()
    assert lista[0]["total_comprado"] == 125000


def test_ficha_sin_compras(autenticado):
    f = crear_cliente(autenticado).json()
    assert f["promedio"] == 0
    assert f["canal_frecuente"] is None
    assert f["ultima_compra"] is None


def test_buscar_numero_no_encuentra_de_mas(autenticado):
    crear_cliente(autenticado)
    crear_cliente(autenticado, nombre="Ana Pérez", whatsapp="315 220 9087")

    def nombres(buscar):
        return [
            c["nombre"] for c in autenticado.get("/api/clientes", params={"buscar": buscar}).json()
        ]

    assert nombres("57") == []
    assert nombres("+57") == []
    assert nombres("Ana 2") == []
    assert nombres("300 456") == ["Valentina Ríos"]
    assert nombres("+57 315") == ["Ana Pérez"]


def test_aviso_de_archivada_sirve_desde_la_venta(autenticado):
    v = crear_cliente(autenticado).json()
    autenticado.delete(f"/api/clientes/{v['id']}")
    r = crear_cliente(autenticado, nombre="Otra")
    assert (
        r.json()["detail"]
        == "Valentina Ríos tiene ese WhatsApp y está archivada: recupérala en Clientes."
    )


def test_whatsapp_unico_en_la_base(autenticado, monkeypatch):
    from app.clientes import clientes

    crear_cliente(autenticado)
    # Dos equipos guardando a la vez: la revisión de la app no alcanza a ver a la otra.
    monkeypatch.setattr(clientes, "_revisar_repetido", lambda *a: None)
    r = crear_cliente(autenticado, nombre="Otra")
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya tienes una clienta con ese WhatsApp."
