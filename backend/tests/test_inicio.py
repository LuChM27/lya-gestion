from app.hora import hoy_bogota
from app.inicio import MESES
from tests.test_insumos import crear_insumo
from tests.test_ventas import item, vender, vitrina  # noqa: F401  (fixture)


def test_inicio_exige_sesion(cliente):
    assert cliente.get("/api/inicio").status_code == 401


def test_inicio_sin_datos(autenticado):
    r = autenticado.get("/api/inicio")
    assert r.status_code == 200
    datos = r.json()
    assert datos["ventas_hoy"] == {"total": 0, "cantidad": 0, "por_canal": {}}
    assert datos["ventas_mes"] == {"total": 0, "cantidad": 0, "mes": MESES[hoy_bogota().month - 1]}
    assert datos["vitrina"] == {"piezas": 0, "valor": 0}
    assert datos["avisos"] == []
    assert datos["por_revisar"] == {"productos": 0, "insumos": 0}


def test_inicio_cuenta_ventas_vitrina_y_avisos(autenticado, vitrina):  # noqa: F811
    vender(autenticado, [item(vitrina["rosa"])], canal="instagram")
    anulada = vender(autenticado, [item(vitrina["negro"])], canal="feria").json()
    autenticado.post(f"/api/ventas/{anulada['id']}/anular")
    hilo = crear_insumo(autenticado, stock_minimo=100)
    datos = autenticado.get("/api/inicio").json()
    assert datos["ventas_hoy"] == {"total": 125000, "cantidad": 1, "por_canal": {"instagram": 1}}
    assert datos["ventas_mes"]["total"] == 125000 and datos["ventas_mes"]["cantidad"] == 1
    assert datos["vitrina"] == {"piezas": 3, "valor": 375000}
    assert datos["avisos"] == [
        {
            "tipo": "insumo",
            "id": hilo["id"],
            "nombre": "Hilo algodón rosa",
            "detalle": "Quedan 0 metros · mínimo 100",
            "estado": "bajo_minimo",
        }
    ]


def test_avisos_de_productos_primero_los_rojos(autenticado, vitrina):  # noqa: F811
    autenticado.put(
        f"/api/inventario/variantes/{vitrina['negro']}", json={"color": "Negro", "stock_minimo": 2}
    )
    autenticado.put(
        f"/api/inventario/variantes/{vitrina['rosa']}",
        json={"color": "Rosa palo", "stock_minimo": 3},
    )
    datos = autenticado.get("/api/inicio").json()
    assert datos["por_revisar"] == {"productos": 2, "insumos": 0}
    avisos = datos["avisos"]
    assert [(a["nombre"], a["estado"], a["detalle"]) for a in avisos] == [
        ("Bolso balde · Negro", "bajo_minimo", "Quedan 1 · mínimo 2"),
        ("Bolso balde · Rosa palo", "por_agotarse", "Quedan 3 · mínimo 3"),
    ]
    assert avisos[0]["tipo"] == "producto" and avisos[0]["id"] == vitrina["modelo"]["id"]


def test_avisos_se_cortan_en_cinco_pero_los_conteos_son_completos(autenticado, vitrina):  # noqa: F811
    for n in range(6):
        crear_insumo(autenticado, nombre=f"Hilo {n}", stock_minimo=10)
    autenticado.put(
        f"/api/inventario/variantes/{vitrina['negro']}", json={"color": "Negro", "stock_minimo": 2}
    )
    datos = autenticado.get("/api/inicio").json()
    assert len(datos["avisos"]) == 5
    assert datos["por_revisar"] == {"productos": 1, "insumos": 6}
