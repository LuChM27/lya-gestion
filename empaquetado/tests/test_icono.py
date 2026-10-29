from pathlib import Path

from icono import crear_icns

RAIZ = Path(__file__).resolve().parents[2]


def test_icns(tmp_path):
    crear_icns(RAIZ / "assets/logo/logo-900.webp", tmp_path / "i.icns")
    assert (tmp_path / "i.icns").read_bytes()[:4] == b"icns"
