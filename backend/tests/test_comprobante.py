import io

from pypdf import PdfReader

from tests.test_ventas import item, vender, vitrina  # noqa: F401  (fixture)


def texto(pdf: bytes) -> str:
    return "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages)


def test_comprobante_trae_los_datos_de_la_venta(autenticado, vitrina):  # noqa: F811
    v = vender(autenticado, [item(vitrina["rosa"], 2)], descuento=10000).json()
    r = autenticado.get(v["comprobante"])
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["cache-control"] == "no-store"
    assert f"comprobante-{v['numero']}.pdf" in r.headers["content-disposition"]
    assert r.headers["content-disposition"].startswith("inline")
    assert r.content.startswith(b"%PDF")
    contenido = texto(r.content)
    for esperado in (
        f"N.º {v['numero']}",
        "Bolso balde · Rosa palo",
        "$ 240.000",
        "Descuento",
        "Pagado con Nequi",
        "Este comprobante no es una factura.",
    ):
        assert esperado in contenido, esperado
    assert "ANULADA" not in contenido


def test_comprobante_cambia_al_anular(autenticado, vitrina):  # noqa: F811
    v = vender(autenticado, [item(vitrina["rosa"])]).json()
    antes = autenticado.get(v["comprobante"])
    anulada = autenticado.post(f"/api/ventas/{v['id']}/anular").json()
    despues = autenticado.get(anulada["comprobante"])
    assert anulada["comprobante"] != v["comprobante"]
    assert despues.status_code == 200 and despues.headers["cache-control"] == "no-store"
    assert despues.content != antes.content
    assert "ANULADA" in texto(despues.content)


def test_comprobante_exige_sesion(cliente):
    assert cliente.get("/api/pedidos/1/comprobante.pdf").status_code == 401


def test_comprobante_inexistente_da_404(autenticado):
    assert autenticado.get("/api/pedidos/999/comprobante.pdf").status_code == 404


def test_comprobante_sin_cuadros_por_letras_raras(autenticado):
    from tests.test_productos import crear_modelo, crear_variante, mover

    m = crear_modelo(autenticado, nombre="Bolso Peonía ✨ ő", precio_venta=90000)
    var = crear_variante(autenticado, m["id"], color="Rosa palo")
    mover(autenticado, var["id"], "ingreso_vitrina", 1)
    v = vender(autenticado, [item(var["id"])]).json()
    contenido = texto(autenticado.get(v["comprobante"]).content)
    assert "Bolso Peonía o · Rosa palo" in contenido
    assert "■" not in contenido and "✨" not in contenido


def test_comprobante_solo_de_ventas(autenticado, config_tmp):
    from sqlalchemy.orm import Session

    from app.db import crear_motor
    from app.ventas.modelos import Pedido

    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        p = Pedido(canal="whatsapp", tipo="encargo", estado="apartado", cliente_id=1, total=0)
        s.add(p)
        s.commit()
        pedido_id = p.id
    motor.dispose()
    assert autenticado.get(f"/api/pedidos/{pedido_id}/comprobante.pdf").status_code == 404
