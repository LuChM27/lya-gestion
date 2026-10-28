"""Control del servicio de L&A con launchctl (dominio gráfico de la usuaria)."""

import os
import subprocess
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

ETIQUETA = "co.lyatejidos.gestion"
URL_SALUD = "http://127.0.0.1:8080/api/salud"
# launchctl bootout devuelve 3 o 113 cuando el servicio ya no estaba cargado.
CODIGOS_YA_APAGADO = {3, 113}


class ErrorServicio(Exception):
    pass


def _consultar_http(url: str, timeout: float) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


@dataclass
class Servicio:
    plist: Path
    uid: int
    ejecutar: Callable = subprocess.run
    consultar: Callable[[str, float], bool] = _consultar_http
    dormir: Callable[[float], None] = time.sleep
    url_salud: str = URL_SALUD

    @classmethod
    def predeterminado(cls) -> "Servicio":
        plist = Path.home() / "Library" / "LaunchAgents" / f"{ETIQUETA}.plist"
        return cls(plist, os.getuid())

    def _launchctl(self, *args: str) -> int:
        return self.ejecutar(["launchctl", *args], capture_output=True, text=True).returncode

    def responde(self) -> bool:
        return self.consultar(self.url_salud, 2.0)

    def encender(self) -> None:
        if self._launchctl("bootstrap", f"gui/{self.uid}", self.plist.as_posix()) == 0:
            return
        # Ya estaba cargado: kickstart lo arranca si estaba detenido.
        if self._launchctl("kickstart", f"gui/{self.uid}/{ETIQUETA}") != 0:
            raise ErrorServicio("launchctl no pudo encender L&A")

    def apagar(self) -> None:
        codigo = self._launchctl("bootout", f"gui/{self.uid}/{ETIQUETA}")
        if codigo != 0 and codigo not in CODIGOS_YA_APAGADO:
            raise ErrorServicio("launchctl no pudo apagar L&A")

    def esperar(self, segundos: int = 30) -> bool:
        for _ in range(segundos):
            if self.responde():
                return True
            self.dormir(1)
        return self.responde()
