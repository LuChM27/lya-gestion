"""Lo que corre el ícono del Dock: python -m app.lanzador abrir|diagnostico."""

import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from app.servicio import ErrorServicio, Servicio
from app.version import VERSION

URL = "http://localhost:8080"
CHROME = Path("/Applications/Google Chrome.app")
REGISTROS = Path.home() / "LyA" / "registros"
LINEAS_DE_REGISTRO = 20


def abrir_url(url: str, existe=Path.exists, ejecutar=subprocess.run) -> None:
    if existe(CHROME):
        # Modo app: ventana propia, sin barra del navegador.
        ejecutar(["open", "-na", "Google Chrome", "--args", f"--app={url}"])
    else:
        ejecutar(["open", url])


def abrir(servicio: Servicio, abrir_url: Callable[[str], None]) -> int:
    if not servicio.responde():
        try:
            servicio.encender()
        except ErrorServicio:
            return 1
        if not servicio.esperar():
            return 1
    abrir_url(URL)
    return 0


def diagnostico(servicio: Servicio, registros: Path) -> str:
    actual = registros.parent / "actual"
    log = registros / "servicio.log"
    if log.is_file():
        lineas = log.read_text(encoding="utf-8", errors="replace").splitlines()
        cola = "\n".join(lineas[-LINEAS_DE_REGISTRO:])
    else:
        cola = "(sin registro)"
    return "\n".join(
        [
            "L&A Gestión — diagnóstico",
            f"Versión: {VERSION}",
            f"Servicio: {'responde' if servicio.responde() else 'no responde'}",
            f"Instalación: {actual.resolve() if actual.exists() else 'no encontrada'}",
            "Últimas líneas del registro:",
            cola,
        ]
    )


def main(argv: list[str]) -> int:
    servicio = Servicio.predeterminado()
    if argv == ["abrir"]:
        return abrir(servicio, abrir_url)
    if argv == ["diagnostico"]:
        print(diagnostico(servicio, REGISTROS))
        return 0
    print("Uso: python -m app.lanzador abrir|diagnostico", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
