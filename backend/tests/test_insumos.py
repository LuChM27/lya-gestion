import pytest

INSUMO = {"nombre": "Hilo algodón rosa", "tipo": "hilo", "unidad": "metros"}


def crear_insumo(c, **cambios) -> dict:
    r = c.post("/api/inventario/insumos", json=INSUMO | cambios)
    assert r.status_code == 201, r.text
    return r.json()


def entrada(c, insumo_id: int, **datos):
    return c.post(f"/api/inventario/insumos/{insumo_id}/entradas", json=datos)


@pytest.fixture
def insumo(autenticado) -> dict:
    return crear_insumo(autenticado, stock_minimo=100, precio_unitario=30)


def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/inventario/insumos").status_code == 401


def test_crear_insumo(autenticado):
    i = crear_insumo(autenticado, proveedor="Hilos del Sinú", precio_unitario=30)
    assert i["existencia"] == 0 and i["precio_unitario"] == 30
    assert i["proveedor"] == "Hilos del Sinú" and i["unidad"] == "metros"
    assert i["estado"] == "ok"


def test_insumo_sin_precio(autenticado):
    assert crear_insumo(autenticado)["precio_unitario"] is None


def test_entrada_en_unidad_de_compra_convierte(autenticado):
    i = crear_insumo(autenticado, unidad_compra="cono", factor_compra=400)
    r = entrada(autenticado, i["id"], cantidad=2, en_unidad_compra=True, precio_unitario=12000)
    assert r.status_code == 201, r.text
    assert r.json()["existencia"] == 800 and r.json()["precio_unitario"] == 30
    precios = autenticado.get(f"/api/inventario/insumos/{i['id']}/precios").json()
    assert [(p["precio_unitario"], p["origen"]) for p in precios] == [(30, "compra")]
    movs = autenticado.get(f"/api/inventario/insumos/{i['id']}/movimientos").json()
    assert [(m["tipo"], m["cantidad"]) for m in movs] == [("compra", 800)]


def test_entrada_al_mismo_precio_no_repite_historial(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=100, precio_unitario=30)
    precios = autenticado.get(f"/api/inventario/insumos/{insumo['id']}/precios").json()
    assert len(precios) == 1 and precios[0]["origen"] == "edicion"


def test_cambiar_precio_guarda_historial(autenticado, insumo):
    datos = INSUMO | {"stock_minimo": 100, "precio_unitario": 35}
    assert autenticado.put(f"/api/inventario/insumos/{insumo['id']}", json=datos).status_code == 200
    r = autenticado.put(f"/api/inventario/insumos/{insumo['id']}", json=datos)
    assert r.json()["precio_unitario"] == 35
    precios = autenticado.get(f"/api/inventario/insumos/{insumo['id']}/precios").json()
    assert [(p["precio_unitario"], p["origen"]) for p in precios] == [
        (35, "edicion"),
        (30, "edicion"),
    ]


def test_entrada_sin_factor_en_unidad_de_compra_da_422(autenticado, insumo):
    r = entrada(autenticado, insumo["id"], cantidad=1, en_unidad_compra=True)
    assert r.status_code == 422
    assert r.json()["detail"] == "Este insumo no tiene unidad de compra."


@pytest.mark.parametrize("parcial", [{"unidad_compra": "cono"}, {"factor_compra": 400}])
def test_conversion_a_medias_da_422(autenticado, parcial):
    r = autenticado.post("/api/inventario/insumos", json=INSUMO | parcial)
    assert r.status_code == 422
    assert r.json()["detail"] == "Escribe la unidad de compra y cuánto trae."


def test_nombre_repetido_da_409_sin_importar_mayusculas(autenticado, insumo):
    r = autenticado.post("/api/inventario/insumos", json=INSUMO | {"nombre": "HILO ALGODÓN ROSA"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya existe el insumo HILO ALGODÓN ROSA."


def test_merma_de_insumo_mayor_que_existencia_da_422(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=10)
    r = autenticado.post(
        f"/api/inventario/insumos/{insumo['id']}/movimientos",
        json={"tipo": "merma", "cantidad": 11},
    )
    assert r.status_code == 422 and r.json()["detail"] == "Solo hay 10 metros."


def test_merma_y_conteo(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=200)
    r = autenticado.post(
        f"/api/inventario/insumos/{insumo['id']}/movimientos",
        json={"tipo": "merma", "cantidad": 80},
    )
    assert r.json()["existencia"] == 120 and r.json()["estado"] == "por_agotarse"
    r = autenticado.post(
        f"/api/inventario/insumos/{insumo['id']}/conteo", json={"cantidad_contada": 90}
    )
    assert r.json()["existencia"] == 90 and r.json()["estado"] == "bajo_minimo"


def test_borrar_insumo_con_movimientos_lo_archiva(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=1)
    assert autenticado.delete(f"/api/inventario/insumos/{insumo['id']}").status_code == 204
    assert autenticado.get("/api/inventario/insumos").json() == []
    archivados = autenticado.get("/api/inventario/insumos?archivados=true").json()
    assert [i["id"] for i in archivados] == [insumo["id"]]


def test_borrar_insumo_sin_movimientos_lo_elimina(autenticado, insumo):
    assert autenticado.delete(f"/api/inventario/insumos/{insumo['id']}").status_code == 204
    assert autenticado.get(f"/api/inventario/insumos/{insumo['id']}").status_code == 404


def test_cantidades_decimales(autenticado, insumo):
    r = entrada(autenticado, insumo["id"], cantidad=12.5)
    assert r.json()["existencia"] == 12.5


def test_lista_busca_filtra_y_ordena(autenticado):
    a = crear_insumo(autenticado, nombre="Argollas doradas", tipo="argolla")
    b = crear_insumo(autenticado, nombre="Cuentas de cristal", tipo="cuentas", stock_minimo=10)
    r = autenticado.get("/api/inventario/insumos").json()
    assert [x["id"] for x in r] == [b["id"], a["id"]]
    r = autenticado.get("/api/inventario/insumos", params={"tipo": "argolla"}).json()
    assert [x["id"] for x in r] == [a["id"]]
    r = autenticado.get("/api/inventario/insumos", params={"buscar": "CRISTAL"}).json()
    assert [x["id"] for x in r] == [b["id"]]


def test_restaurar_insumo_archivado(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=1)
    autenticado.delete(f"/api/inventario/insumos/{insumo['id']}")
    r = autenticado.post(f"/api/inventario/insumos/{insumo['id']}/restaurar")
    assert r.status_code == 200 and r.json()["activo"] is True
    assert [i["id"] for i in autenticado.get("/api/inventario/insumos").json()] == [insumo["id"]]


def test_nombre_de_insumo_archivado_lo_dice(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=1)
    autenticado.delete(f"/api/inventario/insumos/{insumo['id']}")
    r = autenticado.post("/api/inventario/insumos", json=INSUMO)
    assert r.status_code == 409
    assert r.json()["detail"] == (
        "Ya existe el insumo Hilo algodón rosa, archivado. Búscalo en Archivados y vuelve a usarlo."
    )


def test_merma_de_insumo_dice_la_unidad(autenticado, insumo):
    entrada(autenticado, insumo["id"], cantidad=2.5)
    r = autenticado.post(
        f"/api/inventario/insumos/{insumo['id']}/movimientos", json={"tipo": "merma", "cantidad": 3}
    )
    assert r.status_code == 422
    assert r.json()["detail"] == f"Solo hay 2,5 {insumo['unidad']}."
