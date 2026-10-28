from app.config import Config


def test_valores_por_defecto(tmp_path):
    c = Config.desde_entorno({"DATA_DIR": str(tmp_path)})
    assert c.port == 8080 and c.nombre_local == "lya-tejidos" and c.zona == "America/Bogota"
    assert c.data_dir == tmp_path and c.backup_dir.name == "respaldos-dev"


def test_lee_variables(tmp_path):
    c = Config.desde_entorno(
        {"DATA_DIR": str(tmp_path), "PORT": "9090", "BACKUP_DIR": str(tmp_path / "r")}
    )
    assert c.port == 9090 and c.backup_dir == tmp_path / "r"


def test_crea_carpetas(tmp_path):
    c = Config.desde_entorno(
        {"DATA_DIR": str(tmp_path / "d"), "BACKUP_DIR": str(tmp_path / "r")}
    )
    assert c.data_dir.is_dir() and c.backup_dir.is_dir()
