import pytest
from fastapi.testclient import TestClient

from app.config import Config
from app.db import migrar
from app.principal import crear_app


@pytest.fixture
def cliente_web(tmp_path):
    web = tmp_path / "web"
    (web / "assets").mkdir(parents=True)
    (web / "index.html").write_text('<html><div id="root"></div></html>')
    (web / "assets" / "index-abc123.js").write_text("console.log(1)")
    (web / "manifest.webmanifest").write_text("{}")
    (tmp_path / "secreto.txt").write_text("contenido secreto")
    config = Config.desde_entorno(
        {
            "DATA_DIR": str(tmp_path / "datos"),
            "BACKUP_DIR": str(tmp_path / "r"),
            "WEB_DIR": str(web),
        }
    )
    migrar(config)
    with TestClient(crear_app(config)) as c:
        yield c


def test_api_no_store(cliente):
    assert cliente.get("/api/salud").headers["cache-control"] == "no-store"


def test_api_error_tambien_no_store(cliente):
    assert cliente.get("/api/auth/yo").headers["cache-control"] == "no-store"


def test_index_no_cache(cliente_web):
    r = cliente_web.get("/")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-cache"


def test_assets_inmutables(cliente_web):
    r = cliente_web.get("/assets/index-abc123.js")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_archivo_de_la_raiz(cliente_web):
    r = cliente_web.get("/manifest.webmanifest")
    assert r.status_code == 200 and r.text == "{}"


def test_ruta_spa_devuelve_index(cliente_web):
    r = cliente_web.get("/ventas/nueva")
    assert r.status_code == 200 and '<div id="root">' in r.text
    assert r.headers["cache-control"] == "no-cache"


def test_api_inexistente_es_404_json(cliente_web):
    r = cliente_web.get("/api/nada")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")


@pytest.mark.parametrize(
    "ruta",
    [
        "/..%2Fsecreto.txt",
        "/assets/..%2F..%2Fsecreto.txt",
        "/%2e%2e/secreto.txt",
        "/..\\secreto.txt",
    ],
)
def test_no_sale_de_web_dir(cliente_web, ruta):
    r = cliente_web.get(ruta)
    assert "contenido secreto" not in r.text


def test_sin_web_dir_responde_mensaje(cliente):
    r = cliente.get("/")
    assert r.status_code == 503 and "La interfaz no está instalada." in r.text
