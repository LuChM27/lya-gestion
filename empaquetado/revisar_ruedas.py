"""Rechaza dependencias instaladas cuyas ruedas no corren en macOS 12 con esta arquitectura.

Uso: python revisar_ruedas.py <site-packages> <x86_64|arm64>
"""

import re
import sys
from pathlib import Path

PLATAFORMA_MAC = re.compile(r"macosx_(\d+)_(\d+)_(\w+)")
UNIVERSALES = {"universal2", "universal"}


def _etiqueta_valida(tag: str, arquitectura: str, macos_max: tuple[int, int]) -> bool:
    plataforma = tag.split("-")[-1]
    if plataforma == "any":
        return True
    m = PLATAFORMA_MAC.fullmatch(plataforma)
    if not m:
        return False
    version = (int(m[1]), int(m[2]))
    arq = m[3]
    arq_ok = (
        arq == arquitectura
        or arq in UNIVERSALES
        or (arq == "intel" and arquitectura == "x86_64")
    )
    return arq_ok and version <= macos_max


def problemas(
    site_packages: Path, arquitectura: str, macos_max: tuple[int, int] = (12, 0)
) -> list[str]:
    encontrados = []
    for wheel in sorted(site_packages.glob("*.dist-info/WHEEL")):
        paquete = wheel.parent.name.split("-")[0]
        tags = [
            linea.split(":", 1)[1].strip()
            for linea in wheel.read_text(encoding="utf-8").splitlines()
            if linea.startswith("Tag:")
        ]
        if not any(_etiqueta_valida(t, arquitectura, macos_max) for t in tags):
            encontrados.extend(f"{paquete}: {t}" for t in tags)
    return encontrados


if __name__ == "__main__":
    lista = problemas(Path(sys.argv[1]), sys.argv[2])
    for linea in lista:
        print(
            f"Rueda incompatible con macOS 12 {sys.argv[2]}: {linea}", file=sys.stderr
        )
    sys.exit(1 if lista else 0)
