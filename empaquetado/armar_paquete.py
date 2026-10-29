"""Arma el paquete de L&A Gestión para una plataforma de macOS.

Uso:
  python empaquetado/armar_paquete.py --plataforma x86_64-apple-darwin --version 0.1.0 \
      --web frontend/dist --salida build/

El paquete se arma copiando entradas de tar a tar, sin extraer el Python autónomo,
para que funcione igual en Linux, Windows o macOS (el Python trae enlaces simbólicos).
"""

import argparse
import hashlib
import io
import os
import subprocess
import sys
import tarfile
import tempfile
import tomllib
import urllib.request
from pathlib import Path

from icono import crear_icns
from revisar_ruedas import problemas

RAIZ = Path(__file__).resolve().parent.parent
BACKEND = RAIZ / "backend"
SITE_PACKAGES = "python/lib/python3.13/site-packages"
ARQUITECTURAS = {"x86_64-apple-darwin": "x86_64", "aarch64-apple-darwin": "arm64"}
IGNORAR = {"__pycache__", ".pytest_cache"}


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def python_autonomo(plataforma: str, cache: Path) -> Path:
    datos = tomllib.loads(
        (RAIZ / "empaquetado" / "python.toml").read_text(encoding="utf-8")
    )
    entrada = datos[plataforma]
    destino = cache / entrada["url"].rsplit("/", 1)[1].replace("%2B", "+")
    if not destino.is_file():
        cache.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(entrada["url"], destino)
    if sha256(destino) != entrada["sha256"]:
        destino.unlink()
        sys.exit(f"El SHA-256 de {destino.name} no coincide con python.toml")
    return destino


def instalar_dependencias(plataforma: str, destino: Path, temporal: Path) -> None:
    requisitos = temporal / "requisitos.txt"
    subprocess.run(
        [
            "uv",
            "export",
            "--project",
            str(BACKEND),
            "--frozen",
            "--no-dev",
            "--no-emit-project",
            "--quiet",
            "-o",
            str(requisitos),
        ],
        check=True,
    )
    subprocess.run(
        [
            "uv",
            "pip",
            "install",
            "--quiet",
            "--target",
            str(destino),
            "--python-platform",
            plataforma,
            "--python-version",
            "3.13",
            # rumps solo se publica como código fuente (Python puro): se permite construirlo.
            "--only-binary",
            ":all:",
            "--no-binary",
            "rumps",
            "-r",
            str(requisitos),
        ],
        check=True,
        env={**os.environ, "MACOSX_DEPLOYMENT_TARGET": "12.0"},
    )
    rechazadas = problemas(destino, ARQUITECTURAS[plataforma])
    if rechazadas:
        sys.exit("Ruedas incompatibles con macOS 12:\n" + "\n".join(rechazadas))


def _normalizar(info: tarfile.TarInfo) -> tarfile.TarInfo | None:
    if IGNORAR & set(Path(info.name).parts):
        return None
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    info.mode = 0o755 if info.isdir() else 0o644
    return info


def armar(
    plataforma: str, version: str, web_dist: Path, salida: Path, cache: Path
) -> Path:
    if not (web_dist / "index.html").is_file():
        sys.exit(f"Falta la interfaz compilada en {web_dist} (npm run build)")
    nombre = f"lya-gestion-{version}-{plataforma}.tar.gz"
    salida.mkdir(parents=True, exist_ok=True)
    paquete = salida / nombre
    python_tar = python_autonomo(plataforma, cache)

    with tempfile.TemporaryDirectory() as tmp:
        temporal = Path(tmp)
        dependencias = temporal / "site-packages"
        instalar_dependencias(plataforma, dependencias, temporal)
        icns = temporal / "icono.icns"
        crear_icns(RAIZ / "assets" / "logo" / "logo-900.webp", icns)

        with tarfile.open(paquete, "w:gz") as tar:
            with tarfile.open(python_tar, "r:gz") as origen:
                for miembro in origen:
                    archivo = origen.extractfile(miembro) if miembro.isfile() else None
                    tar.addfile(miembro, archivo)
            tar.add(dependencias, SITE_PACKAGES, filter=_normalizar)
            tar.add(BACKEND / "app", "app", filter=_normalizar)
            tar.add(BACKEND / "migraciones", "migraciones", filter=_normalizar)
            tar.add(BACKEND / "alembic.ini", "alembic.ini", filter=_normalizar)
            tar.add(web_dist, "web", filter=_normalizar)
            tar.add(icns, "recursos/icono.icns", filter=_normalizar)
            for recurso in [
                RAIZ / "empaquetado" / "lanzador.applescript",
                RAIZ / "deploy" / "co.lyatejidos.gestion.plist",
                RAIZ / "deploy" / "co.lyatejidos.menu.plist",
            ]:
                tar.add(recurso, f"recursos/{recurso.name}", filter=_normalizar)
            datos_version = version.encode()
            info = tarfile.TarInfo("VERSION")
            info.size, info.mode = len(datos_version), 0o644
            tar.addfile(info, io.BytesIO(datos_version))

    (salida / f"{nombre}.sha256").write_text(
        f"{sha256(paquete)}  {nombre}\n", encoding="utf-8"
    )
    return paquete


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--plataforma", required=True, choices=sorted(ARQUITECTURAS))
    p.add_argument("--version", required=True)
    p.add_argument("--web", type=Path, default=RAIZ / "frontend" / "dist")
    p.add_argument("--salida", type=Path, default=RAIZ / "build")
    p.add_argument("--cache", type=Path, default=RAIZ / "build" / "cache")
    a = p.parse_args()
    print(armar(a.plataforma, a.version, a.web, a.salida, a.cache))


if __name__ == "__main__":
    main()
