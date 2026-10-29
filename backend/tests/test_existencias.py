from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.db import crear_motor, migrar
from app.inventario.existencias import (
    ErrorInventario,
    cantidad_texto,
    contar,
    estado_stock,
    existencia,
    existencias,
    registrar_movimiento,
)
from app.inventario.modelos import Insumo, Modelo, Variante


@pytest.fixture
def s(config_tmp):
    migrar(config_tmp)
    motor = crear_motor(config_tmp)
    with Session(motor) as sesion:
        yield sesion
    motor.dispose()


@pytest.fixture
def variante(s):
    m = Modelo(nombre="Bolso balde", categoria="crochet", precio_venta=125000)
    s.add(m)
    s.flush()
    v = Variante(modelo_id=m.id, color="Rosa palo", sku="LA-0001")
    s.add(v)
    s.flush()
    return v


@pytest.fixture
def insumo(s):
    i = Insumo(nombre="Hilo algodón rosa", tipo="hilo", unidad="metros")
    s.add(i)
    s.flush()
    return i


def test_existencia_es_la_suma_de_movimientos(s, variante):
    registrar_movimiento(s, tipo="ingreso_vitrina", cantidad=Decimal(3), variante_id=variante.id)
    registrar_movimiento(s, tipo="merma", cantidad=Decimal(-1), variante_id=variante.id)
    assert existencia(s, variante_id=variante.id) == 2


def test_existencia_sin_movimientos_es_cero(s, insumo):
    assert existencia(s, insumo_id=insumo.id) == 0


def test_merma_mayor_que_la_existencia_falla(s, insumo):
    registrar_movimiento(s, tipo="compra", cantidad=Decimal("12.5"), insumo_id=insumo.id)
    with pytest.raises(ErrorInventario, match="Solo hay 12,5."):
        registrar_movimiento(s, tipo="merma", cantidad=Decimal(-13), insumo_id=insumo.id)
    assert existencia(s, insumo_id=insumo.id) == Decimal("12.5")


def test_negativo_permitido_si_se_pide(s, insumo):
    registrar_movimiento(
        s,
        tipo="inicio_produccion",
        cantidad=Decimal(-5),
        insumo_id=insumo.id,
        permitir_negativo=True,
    )
    assert existencia(s, insumo_id=insumo.id) == -5


def test_conteo_crea_ajuste_por_la_diferencia(s, insumo):
    registrar_movimiento(s, tipo="compra", cantidad=Decimal(10), insumo_id=insumo.id)
    m = contar(s, cantidad_contada=Decimal(7), insumo_id=insumo.id)
    assert m.tipo == "ajuste" and m.cantidad == -3
    assert contar(s, cantidad_contada=Decimal(7), insumo_id=insumo.id) is None
    assert existencia(s, insumo_id=insumo.id) == 7


def test_conteo_negativo_falla(s, insumo):
    with pytest.raises(ErrorInventario, match="El conteo no puede ser negativo."):
        contar(s, cantidad_contada=Decimal(-1), insumo_id=insumo.id)


@pytest.mark.parametrize(
    ("exist", "minimo", "esperado"),
    [
        (Decimal(11), Decimal(8), "ok"),
        (Decimal(10), Decimal(8), "por_agotarse"),
        (Decimal(8), Decimal(8), "por_agotarse"),
        (Decimal(7), Decimal(8), "bajo_minimo"),
        (Decimal(0), Decimal(0), "ok"),
        (Decimal(-1), Decimal(0), "bajo_minimo"),
    ],
)
def test_estado_stock(exist, minimo, esperado):
    assert estado_stock(exist, minimo) == esperado


def test_existencias_agrupa_en_una_consulta(s, variante):
    otra = Variante(modelo_id=variante.modelo_id, color="Negro", sku="LA-0002")
    s.add(otra)
    s.flush()
    registrar_movimiento(s, tipo="ingreso_vitrina", cantidad=Decimal(2), variante_id=variante.id)
    assert existencias(s, variantes=[variante.id, otra.id]) == {variante.id: 2, otra.id: 0}


def test_cantidad_cero_falla(s, insumo):
    with pytest.raises(ErrorInventario, match="La cantidad no puede ser 0."):
        registrar_movimiento(s, tipo="compra", cantidad=Decimal(0), insumo_id=insumo.id)


def test_tipo_desconocido_falla(s, insumo):
    with pytest.raises(ValueError):
        registrar_movimiento(s, tipo="regalo", cantidad=Decimal(1), insumo_id=insumo.id)


@pytest.mark.parametrize(
    ("d", "texto"),
    [
        (Decimal("12.500"), "12,5"),
        (Decimal(3), "3"),
        (Decimal("3.000"), "3"),
        (Decimal(1200), "1.200"),
        (Decimal("-0.25"), "-0,25"),
    ],
)
def test_cantidad_texto(d, texto):
    assert cantidad_texto(d) == texto
