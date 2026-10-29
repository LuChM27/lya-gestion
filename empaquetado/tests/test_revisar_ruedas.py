import pytest
from revisar_ruedas import problemas


def instalar(site, nombre, *tags):
    info = site / f"{nombre}-1.0.dist-info"
    info.mkdir(parents=True)
    lineas = ["Wheel-Version: 1.0", "Root-Is-Purelib: false"] + [
        f"Tag: {t}" for t in tags
    ]
    (info / "WHEEL").write_text("\n".join(lineas) + "\n")


@pytest.mark.parametrize(
    "tag,ok",
    [
        ("py3-none-any", True),
        ("cp313-cp313-macosx_10_13_x86_64", True),
        ("cp313-cp313-macosx_10_9_universal2", True),
        ("cp313-cp313-macosx_12_0_x86_64", True),
        ("cp313-abi3-macosx_10_9_x86_64", True),
        ("cp313-cp313-macosx_13_0_x86_64", False),
        ("cp313-cp313-macosx_11_0_arm64", False),
        ("cp313-cp313-manylinux_2_17_x86_64", False),
        ("cp313-cp313-win_amd64", False),
    ],
)
def test_etiquetas_x86_64(tmp_path, tag, ok):
    instalar(tmp_path, "paquete", tag)
    resultado = problemas(tmp_path, "x86_64")
    assert (resultado == []) is ok
    if not ok:
        assert resultado == [f"paquete: {tag}"]


def test_arm64_acepta_arm64(tmp_path):
    instalar(tmp_path, "paquete", "cp313-cp313-macosx_11_0_arm64")
    assert problemas(tmp_path, "arm64") == []


def test_basta_una_etiqueta_valida(tmp_path):
    instalar(
        tmp_path,
        "paquete",
        "cp313-cp313-macosx_14_0_x86_64",
        "cp313-cp313-macosx_10_9_x86_64",
    )
    assert problemas(tmp_path, "x86_64") == []


def test_varios_paquetes(tmp_path):
    instalar(tmp_path, "bueno", "py3-none-any")
    instalar(tmp_path, "malo", "cp313-cp313-macosx_15_0_x86_64")
    assert problemas(tmp_path, "x86_64") == ["malo: cp313-cp313-macosx_15_0_x86_64"]
