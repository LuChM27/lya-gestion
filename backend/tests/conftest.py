import pytest
from fastapi.testclient import TestClient

from app.config import Config
from app.db import migrar
from app.principal import crear_app


@pytest.fixture
def config_tmp(tmp_path) -> Config:
    return Config.desde_entorno(
        {
            "DATA_DIR": str(tmp_path / "datos"),
            "BACKUP_DIR": str(tmp_path / "respaldos"),
            "WEB_DIR": str(tmp_path / "web-inexistente"),
        }
    )


@pytest.fixture
def cliente(config_tmp) -> TestClient:
    migrar(config_tmp)
    with TestClient(crear_app(config_tmp)) as c:
        yield c
