from app.version import VERSION


def test_salud(cliente):
    r = cliente.get("/api/salud")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "version": VERSION, "base": "ok"}


def test_salud_con_base_rota(cliente):
    cliente.app.state.motor.dispose()
    cliente.app.state.motor = crear_motor_roto()
    r = cliente.get("/api/salud")
    assert r.status_code == 503
    assert r.json()["base"] == "error"


def crear_motor_roto():
    from sqlalchemy import create_engine

    # Un directorio inexistente hace fallar la conexión de SQLite.
    return create_engine("sqlite:///Z:/no/existe/lya.db")
