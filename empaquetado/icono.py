"""Convierte el logo en el ícono .icns de L&A Gestión.app."""

import sys
from pathlib import Path

from PIL import Image


def crear_icns(origen: Path, destino: Path) -> None:
    logo = Image.open(origen).convert("RGBA").resize((1024, 1024), Image.LANCZOS)
    logo.save(destino, format="ICNS")


if __name__ == "__main__":
    crear_icns(Path(sys.argv[1]), Path(sys.argv[2]))
