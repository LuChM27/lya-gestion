from sqlalchemy import inspect

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
