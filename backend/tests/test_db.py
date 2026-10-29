import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import crear_motor, migrar


def test_migrar_crea_tablas_y_wal(config_tmp):
    migrar(config_tmp)
    motor = crear_motor(config_tmp)
    with motor.connect() as c:
        assert c.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"
        assert c.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    assert {"usuario", "sesion"} <= set(inspect(motor).get_table_names())
    motor.dispose()


def test_migrar_dos_veces_no_falla(config_tmp):
    migrar(config_tmp)
    migrar(config_tmp)


def test_migrar_crea_tablas_de_inventario(config_tmp):
    migrar(config_tmp)
    motor = crear_motor(config_tmp)
    tablas = set(inspect(motor).get_table_names())
    assert {"modelo", "variante", "insumo", "precio_insumo", "movimiento_inventario"} <= tablas
    motor.dispose()


def test_movimiento_exige_variante_o_insumo(config_tmp):
    from app.inventario.modelos import MovimientoInventario

    migrar(config_tmp)
    motor = crear_motor(config_tmp)
    with Session(motor) as s:
        s.add(MovimientoInventario(tipo="ajuste", cantidad=1))
        with pytest.raises(IntegrityError):
            s.commit()
    motor.dispose()
