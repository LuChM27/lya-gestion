import re
from datetime import datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modelos import Sesion

CUENTA = {"usuario": "Laura ", "contrasena": "tejidos2026"}


def configurar(cliente) -> str:
    r = cliente.post("/api/auth/configurar", json=CUENTA)
    assert r.status_code == 201
    return r.json()["codigo_recuperacion"]


def test_flujo_completo(cliente):
    assert cliente.get("/api/auth/estado").json() == {"configurado": False}
    codigo = configurar(cliente)
    assert re.fullmatch(r"\d{8}", codigo)
    assert cliente.get("/api/auth/estado").json() == {"configurado": True}
    assert cliente.get("/api/auth/yo").json() == {"usuario": "laura"}
    assert cliente.post("/api/auth/salir").status_code == 204
    r = cliente.get("/api/auth/yo")
    assert r.status_code == 401 and r.json()["detail"] == "Inicia sesión para continuar."
    r = cliente.post("/api/auth/entrar", json={"usuario": "LAURA", "contrasena": "tejidos2026"})
    assert r.status_code == 204
    assert cliente.get("/api/auth/yo").json() == {"usuario": "laura"}


def test_cookie_segura(cliente):
    r = cliente.post("/api/auth/configurar", json=CUENTA)
    cookie = r.headers["set-cookie"]
    assert "lya_sesion=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=strict" in cookie
    assert "Max-Age=2592000" in cookie
    assert "Secure" not in cookie


def test_configurar_dos_veces(cliente):
    configurar(cliente)
    r = cliente.post("/api/auth/configurar", json={"usuario": "otra", "contrasena": "12345678"})
    assert r.status_code == 409
    assert r.json()["detail"] == "La cuenta ya está creada. Inicia sesión."


def test_contrasena_corta(cliente):
    r = cliente.post("/api/auth/configurar", json={"usuario": "laura", "contrasena": "corta"})
    assert r.status_code == 422
    assert r.json()["detail"] == "La contraseña debe tener al menos 8 caracteres."


def test_credenciales_malas(cliente):
    configurar(cliente)
    cliente.cookies.clear()
    r = cliente.post("/api/auth/entrar", json={"usuario": "laura", "contrasena": "mala-clave"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Usuario o contraseña incorrectos."
    r = cliente.post("/api/auth/entrar", json={"usuario": "nadie", "contrasena": "tejidos2026"})
    assert r.status_code == 401


def test_sexto_intento_bloqueado(cliente):
    configurar(cliente)
    cliente.cookies.clear()
    for _ in range(5):
        cliente.post("/api/auth/entrar", json={"usuario": "laura", "contrasena": "mala-clave"})
    r = cliente.post("/api/auth/entrar", json={"usuario": "laura", "contrasena": "tejidos2026"})
    assert r.status_code == 429
    assert r.json()["detail"] == "Demasiados intentos. Espera un minuto y vuelve a intentarlo."


def test_sesion_expirada(cliente):
    configurar(cliente)
    with Session(cliente.app.state.motor) as s:
        s.execute(update(Sesion).values(expira=datetime.now() - timedelta(seconds=1)))
        s.commit()
    assert cliente.get("/api/auth/yo").status_code == 401


def test_recuperar(cliente):
    codigo = configurar(cliente)
    cliente.cookies.clear()
    r = cliente.post(
        "/api/auth/recuperar", json={"codigo": codigo, "contrasena_nueva": "nueva-clave-1"}
    )
    assert r.status_code == 200
    nuevo = r.json()["codigo_recuperacion"]
    assert re.fullmatch(r"\d{8}", nuevo) and nuevo != codigo
    r = cliente.post("/api/auth/entrar", json={"usuario": "laura", "contrasena": "nueva-clave-1"})
    assert r.status_code == 204
    r = cliente.post(
        "/api/auth/recuperar", json={"codigo": codigo, "contrasena_nueva": "otra-clave-2"}
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "El código de recuperación no es correcto."


def test_codigo_malo_cuenta_para_el_limite(cliente):
    configurar(cliente)
    for _ in range(5):
        cliente.post(
            "/api/auth/recuperar", json={"codigo": "00000000", "contrasena_nueva": "x" * 8}
        )
    r = cliente.post("/api/auth/entrar", json=CUENTA)
    assert r.status_code == 429


def test_recuperar_sin_cuenta(cliente):
    r = cliente.post(
        "/api/auth/recuperar", json={"codigo": "12345678", "contrasena_nueva": "x" * 8}
    )
    assert r.status_code == 400
