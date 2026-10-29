import subprocess

import pytest

from app import red
from app.red import ip_local


def falso_run(respuestas: dict[tuple[str, ...], str]):
    def ejecutar(args, **_):
        salida = respuestas.get(tuple(args))
        if salida is None:
            return subprocess.CompletedProcess(args, 1, "", "")
        return subprocess.CompletedProcess(args, 0, salida, "")

    return ejecutar


def test_ip_por_ipconfig_en_mac():
    ejecutar = falso_run({("ipconfig", "getifaddr", "en0"): "192.168.1.23\n"})
    assert ip_local(ejecutar, "darwin") == "192.168.1.23"


def test_prueba_en1_si_en0_falla():
    ejecutar = falso_run({("ipconfig", "getifaddr", "en1"): "10.0.0.5\n"})
    assert ip_local(ejecutar, "darwin") == "10.0.0.5"


def test_sin_red_devuelve_none(monkeypatch):
    def sin_red():
        raise OSError("sin red")

    monkeypatch.setattr(red, "_ip_por_socket", sin_red)
    assert ip_local(falso_run({}), "darwin") is None


def test_fuera_de_mac_usa_socket(monkeypatch):
    monkeypatch.setattr(red, "_ip_por_socket", lambda: "172.16.0.9")
    assert ip_local(falso_run({}), "win32") == "172.16.0.9"


def test_acceso_requiere_sesion(cliente):
    assert cliente.get("/api/acceso").status_code == 401


@pytest.fixture
def cliente_con_sesion(cliente):
    r = cliente.post("/api/auth/configurar", json={"usuario": "laura", "contrasena": "tejidos2026"})
    assert r.status_code == 201
    return cliente


def test_acceso(cliente_con_sesion):
    cliente_con_sesion.app.state.ip_local = lambda: "192.168.1.23"
    assert cliente_con_sesion.get("/api/acceso").json() == {
        "nombre_local": "http://lya-tejidos.local:8080",
        "ip": "http://192.168.1.23:8080",
    }


def test_acceso_sin_ip(cliente_con_sesion):
    cliente_con_sesion.app.state.ip_local = lambda: None
    assert cliente_con_sesion.get("/api/acceso").json()["ip"] is None
