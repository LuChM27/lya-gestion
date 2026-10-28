from app.version import VERSION


def test_salud(cliente):
    r = cliente.get("/api/salud")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "version": VERSION, "base": "ok"}
