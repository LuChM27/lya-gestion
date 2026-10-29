import pytest

MODELO = {
    "nombre": "Bolso balde",
    "categoria": "crochet",
    "precio_venta": 125000,
    "horas_tejido": 6,
}


def crear_modelo(c, **cambios) -> dict:
    r = c.post("/api/inventario/modelos", json=MODELO | cambios)
    assert r.status_code == 201, r.text
    return r.json()


def crear_variante(c, modelo_id: int, **datos) -> dict:
    r = c.post(
        f"/api/inventario/modelos/{modelo_id}/variantes", json={"color": "Rosa palo"} | datos
    )
    assert r.status_code == 201, r.text
    return r.json()


def mover(c, variante_id: int, tipo: str, cantidad):
    return c.post(
        f"/api/inventario/variantes/{variante_id}/movimientos",
        json={"tipo": tipo, "cantidad": cantidad},
    )


@pytest.fixture
def modelo(autenticado) -> dict:
    return crear_modelo(autenticado)


@pytest.fixture
def variante(autenticado, modelo) -> dict:
    return crear_variante(autenticado, modelo["id"], stock_minimo=2)


def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/inventario/modelos").status_code == 401


def test_crear_modelo_con_variantes_y_stock(autenticado):
    m = crear_modelo(autenticado)
    v = crear_variante(autenticado, m["id"], stock_minimo=2)
    assert v["sku"] == f"LA-{v['id']:04d}"
    assert mover(autenticado, v["id"], "ingreso_vitrina", 2).status_code == 201
    d = autenticado.get(f"/api/inventario/modelos/{m['id']}").json()
    assert d["unidades"] == 2
    assert d["horas_tejido"] == 6
    assert d["variantes"][0]["existencia"] == 2
    assert d["variantes"][0]["estado"] == "por_agotarse"
    assert d["estado"] == "por_agotarse"


def test_editar_modelo(autenticado, modelo):
    r = autenticado.put(
        f"/api/inventario/modelos/{modelo['id']}", json=MODELO | {"precio_venta": 130000}
    )
    assert r.status_code == 200 and r.json()["precio_venta"] == 130000


def test_categoria_invalida_da_422(autenticado):
    r = autenticado.post("/api/inventario/modelos", json=MODELO | {"categoria": "cuero"})
    assert r.status_code == 422


def test_color_repetido_da_409(autenticado, modelo):
    crear_variante(autenticado, modelo["id"])
    r = autenticado.post(
        f"/api/inventario/modelos/{modelo['id']}/variantes", json={"color": "Rosa palo"}
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya existe la variante Rosa palo en este modelo."


def test_sku_repetido_da_409(autenticado, modelo):
    crear_variante(autenticado, modelo["id"], sku="BB-01")
    r = autenticado.post(
        f"/api/inventario/modelos/{modelo['id']}/variantes", json={"color": "Negro", "sku": "BB-01"}
    )
    assert r.status_code == 409 and r.json()["detail"] == "El código BB-01 ya está en uso."


def test_merma_mayor_que_la_existencia_da_422(autenticado, variante):
    r = mover(autenticado, variante["id"], "merma", 1)
    assert r.status_code == 422 and r.json()["detail"] == "Solo hay 0."


def test_merma_resta(autenticado, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 3)
    r = mover(autenticado, variante["id"], "merma", 1)
    assert r.status_code == 201 and r.json()["existencia"] == 2


def test_tipo_de_movimiento_no_permitido_da_422(autenticado, variante):
    assert mover(autenticado, variante["id"], "venta", 1).status_code == 422


def test_pieza_unica_no_pasa_de_una_unidad(autenticado, modelo):
    v = crear_variante(autenticado, modelo["id"], color="Única", pieza_unica=True, stock_minimo=3)
    assert v["stock_minimo"] == 0
    assert mover(autenticado, v["id"], "ingreso_vitrina", 1).status_code == 201
    r = mover(autenticado, v["id"], "ingreso_vitrina", 1)
    assert r.status_code == 422
    assert r.json()["detail"] == "Una pieza única solo puede tener 1 unidad."


def test_conteo_de_variante(autenticado, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 5)
    r = autenticado.post(
        f"/api/inventario/variantes/{variante['id']}/conteo", json={"cantidad_contada": 4}
    )
    assert r.status_code == 200 and r.json()["existencia"] == 4
    movs = autenticado.get(f"/api/inventario/variantes/{variante['id']}/movimientos").json()
    assert [(m["tipo"], m["cantidad"]) for m in movs] == [("ajuste", -1), ("ingreso_vitrina", 5)]


def test_editar_variante(autenticado, variante):
    r = autenticado.put(
        f"/api/inventario/variantes/{variante['id']}",
        json={"color": "Rosa viejo", "stock_minimo": 1, "pieza_unica": False},
    )
    assert r.status_code == 200 and r.json()["color"] == "Rosa viejo"
    assert r.json()["sku"] == variante["sku"]


def test_borrar_modelo_con_movimientos_lo_archiva(autenticado, modelo, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 1)
    assert autenticado.delete(f"/api/inventario/modelos/{modelo['id']}").status_code == 204
    assert autenticado.get("/api/inventario/modelos").json() == []
    archivados = autenticado.get("/api/inventario/modelos?archivados=true").json()
    assert [m["id"] for m in archivados] == [modelo["id"]]
    assert archivados[0]["activo"] is False
    movs = autenticado.get(f"/api/inventario/variantes/{variante['id']}/movimientos").json()
    assert len(movs) == 1


def test_borrar_modelo_sin_movimientos_lo_elimina(autenticado, modelo, variante):
    assert autenticado.delete(f"/api/inventario/modelos/{modelo['id']}").status_code == 204
    assert autenticado.get(f"/api/inventario/modelos/{modelo['id']}").status_code == 404


def test_borrar_variante_con_movimientos_la_archiva(autenticado, modelo, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 1)
    assert autenticado.delete(f"/api/inventario/variantes/{variante['id']}").status_code == 204
    d = autenticado.get(f"/api/inventario/modelos/{modelo['id']}").json()
    assert d["variantes"][0]["activo"] is False
    assert d["unidades"] == 0


def test_modelo_inexistente_da_404(autenticado):
    assert autenticado.get("/api/inventario/modelos/999").status_code == 404


def test_buscar_ignora_tildes_y_mayusculas(autenticado):
    m = crear_modelo(autenticado, nombre="Cartera Murano", categoria="murano")
    crear_variante(autenticado, m["id"], color="Azul cielo")
    crear_modelo(autenticado, nombre="Bolso balde")
    for texto in ("murano", "AZUL", "murano azul"):
        r = autenticado.get("/api/inventario/modelos", params={"buscar": texto}).json()
        assert [x["id"] for x in r] == [m["id"]], texto
    otro = crear_modelo(autenticado, nombre="Mochila pequeña")
    r = autenticado.get("/api/inventario/modelos", params={"buscar": "PEQUENA"}).json()
    assert [x["id"] for x in r] == [otro["id"]]


def test_filtrar_por_categoria(autenticado):
    m = crear_modelo(autenticado, nombre="Pulsera", categoria="cristal")
    crear_modelo(autenticado)
    r = autenticado.get("/api/inventario/modelos", params={"categoria": "cristal"}).json()
    assert [x["id"] for x in r] == [m["id"]]


def test_lista_pone_primero_lo_bajo_minimo(autenticado):
    a = crear_modelo(autenticado, nombre="A sin alerta")
    b = crear_modelo(autenticado, nombre="B bajo mínimo")
    c = crear_modelo(autenticado, nombre="C por agotarse")
    crear_variante(autenticado, b["id"], stock_minimo=3)
    vc = crear_variante(autenticado, c["id"], stock_minimo=4)
    mover(autenticado, vc["id"], "ingreso_vitrina", 5)
    r = autenticado.get("/api/inventario/modelos").json()
    assert [x["id"] for x in r] == [b["id"], c["id"], a["id"]]
    assert [x["estado"] for x in r] == ["bajo_minimo", "por_agotarse", "ok"]


def test_cantidades_son_numeros_json(autenticado, variante):
    r = mover(autenticado, variante["id"], "ingreso_vitrina", 3)
    assert r.json()["existencia"] == 3
    assert isinstance(r.json()["existencia"], (int, float))
    assert isinstance(r.json()["stock_minimo"], (int, float))


def test_respuestas_no_store(autenticado):
    assert autenticado.get("/api/inventario/modelos").headers["cache-control"] == "no-store"


def test_restaurar_modelo_archivado(autenticado, modelo, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 1)
    autenticado.delete(f"/api/inventario/modelos/{modelo['id']}")
    r = autenticado.post(f"/api/inventario/modelos/{modelo['id']}/restaurar")
    assert r.status_code == 200 and r.json()["activo"] is True
    assert r.json()["variantes"][0]["activo"] is True
    assert [m["id"] for m in autenticado.get("/api/inventario/modelos").json()] == [modelo["id"]]


def test_restaurar_variante_archivada(autenticado, modelo, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 1)
    autenticado.delete(f"/api/inventario/variantes/{variante['id']}")
    r = autenticado.post(f"/api/inventario/variantes/{variante['id']}/restaurar")
    assert r.status_code == 200 and r.json()["activo"] is True


def test_color_de_variante_archivada_lo_dice(autenticado, modelo, variante):
    mover(autenticado, variante["id"], "ingreso_vitrina", 1)
    autenticado.delete(f"/api/inventario/variantes/{variante['id']}")
    r = autenticado.post(
        f"/api/inventario/modelos/{modelo['id']}/variantes", json={"color": "Rosa palo"}
    )
    assert r.status_code == 409
    assert r.json()["detail"] == (
        "Ya existe la variante Rosa palo en este modelo, archivada. Vuelve a usarla desde la ficha."
    )


def test_dato_invalido_da_mensaje_en_espanol(autenticado, variante):
    r = mover(autenticado, variante["id"], "ingreso_vitrina", 0)
    assert r.status_code == 422
    assert r.json()["detail"] == "Revisa los datos: hay un valor que no es válido."


@pytest.mark.parametrize(
    ("ruta", "cuerpo"),
    [
        ("movimientos", {"tipo": "ingreso_vitrina", "cantidad": 1.5}),
        ("conteo", {"cantidad_contada": 2.5}),
    ],
)
def test_productos_se_cuentan_en_unidades_enteras(autenticado, variante, ruta, cuerpo):
    r = autenticado.post(f"/api/inventario/variantes/{variante['id']}/{ruta}", json=cuerpo)
    assert r.status_code == 422
    assert r.json()["detail"] == "Los productos se cuentan en unidades enteras."


def test_minimo_de_variante_en_unidades_enteras(autenticado, modelo):
    r = autenticado.post(
        f"/api/inventario/modelos/{modelo['id']}/variantes",
        json={"color": "Azul", "stock_minimo": 1.5},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "Los productos se cuentan en unidades enteras."


def test_color_y_codigo_repetidos_sin_importar_mayusculas(autenticado, modelo):
    crear_variante(autenticado, modelo["id"], color="Azul petróleo", sku="LA-AZ")
    r = autenticado.post(
        f"/api/inventario/modelos/{modelo['id']}/variantes", json={"color": "azul PETRÓLEO"}
    )
    assert r.status_code == 409
    otro = crear_modelo(autenticado, nombre="Cartera")
    r = autenticado.post(
        f"/api/inventario/modelos/{otro['id']}/variantes", json={"color": "Azul", "sku": "la-az"}
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "El código la-az ya está en uso."
