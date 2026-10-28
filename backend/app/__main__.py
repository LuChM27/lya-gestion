"""Arranque del servicio: python -m app (lo llama launchd)."""

import os
import socket
import sys
from collections.abc import Mapping

import uvicorn

from app.config import Config
from app.db import migrar
from app.principal import crear_app

HOST = "0.0.0.0"


def puerto_libre(puerto: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if sys.platform != "win32":
            # Igual que Uvicorn; en Windows SO_REUSEADDR permitiría robar un puerto en uso.
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((HOST, puerto))
        except OSError:
            return False
    return True


def main(env: Mapping[str, str] = os.environ) -> int:
    config = Config.desde_entorno(env)
    if not puerto_libre(config.port):
        print(f"El puerto {config.port} está ocupado por otro programa.", file=sys.stderr)
        return 1
    migrar(config)
    uvicorn.run(crear_app(config), host=HOST, port=config.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
