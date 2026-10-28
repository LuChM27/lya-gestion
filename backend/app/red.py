"""Direcciones para entrar desde el celular: nombre .local e IP actual de la Mac."""

import socket
import subprocess
import sys

from fastapi import APIRouter, Request

from app.auth.dependencias import UsuarioActual

router = APIRouter()


def _ip_por_socket() -> str:
    # Conectar un socket UDP no envía datos; solo elige la interfaz de salida.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("192.0.2.1", 80))
        return s.getsockname()[0]


def ip_local(ejecutar=subprocess.run, sistema: str = sys.platform) -> str | None:
    if sistema == "darwin":
        for interfaz in ("en0", "en1"):
            try:
                r = ejecutar(
                    ["ipconfig", "getifaddr", interfaz], capture_output=True, text=True, timeout=2
                )
            except (OSError, subprocess.SubprocessError):
                continue
            if r.returncode == 0 and r.stdout.strip():
                return r.stdout.strip()
    try:
        return _ip_por_socket()
    except OSError:
        return None


@router.get("/api/acceso")
def acceso(request: Request, _usuario: UsuarioActual) -> dict:
    config = request.app.state.config
    ip = request.app.state.ip_local()
    return {
        "nombre_local": f"http://{config.nombre_local}.local:{config.port}",
        "ip": f"http://{ip}:{config.port}" if ip else None,
    }
