from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import crear_motor
from app.ventas.modelos import Cliente


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
        "Valentina Ríos tiene ese WhatsApp y está archivada: recupérala en «Ver archivadas»."
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
