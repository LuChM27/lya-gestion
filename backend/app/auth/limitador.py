"""Límite de intentos fallidos por clave (la IP) dentro de una ventana de tiempo."""

import time
from collections import defaultdict, deque
from collections.abc import Callable


class Limitador:
    def __init__(
        self,
        max_intentos: int = 5,
        ventana: float = 60.0,
        reloj: Callable[[], float] = time.monotonic,
    ):
        self.max_intentos = max_intentos
        self.ventana = ventana
        self.reloj = reloj
        self._fallos: dict[str, deque[float]] = defaultdict(deque)

    def _vigentes(self, clave: str) -> deque[float]:
        fallos = self._fallos[clave]
        limite = self.reloj() - self.ventana
        while fallos and fallos[0] <= limite:
            fallos.popleft()
        return fallos

    def bloqueado(self, clave: str) -> bool:
        return len(self._vigentes(clave)) >= self.max_intentos

    def registrar_fallo(self, clave: str) -> None:
        self._vigentes(clave).append(self.reloj())

    def limpiar(self, clave: str) -> None:
        self._fallos.pop(clave, None)
