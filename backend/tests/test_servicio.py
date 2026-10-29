import subprocess
from pathlib import Path

import pytest

from app.servicio import ErrorServicio, Servicio


def registrar_run(codigos: dict[str, int] | None = None):
    """Simula launchctl: guarda cada llamada y devuelve el código pedido por subcomando."""
    codigos = codigos or {}
    llamadas: list[list[str]] = []

    def ejecutar(args, **_):
        llamadas.append(list(args))
        return subprocess.CompletedProcess(args, codigos.get(args[1], 0), "", "")

    return llamadas, ejecutar


def servicio(ejecutar=None, respuestas=None, dormidas=None):
    respuestas = list(respuestas or [True])

    def consultar(_url, _timeout):
        return respuestas.pop(0) if len(respuestas) > 1 else respuestas[0]

    return Servicio(
        Path("/u/Library/LaunchAgents/co.lyatejidos.gestion.plist"),
        501,
        ejecutar=ejecutar or registrar_run()[1],
        consultar=consultar,
        dormir=(dormidas.append if dormidas is not None else lambda _s: None),
    )


def test_encender_usa_bootstrap():
    llamadas, ejecutar = registrar_run()
    servicio(ejecutar).encender()
    assert llamadas == [
        ["launchctl", "bootstrap", "gui/501", "/u/Library/LaunchAgents/co.lyatejidos.gestion.plist"]
    ]


def test_encender_ya_encendido_usa_kickstart():
    llamadas, ejecutar = registrar_run(codigos={"bootstrap": 5})
    servicio(ejecutar).encender()
    assert llamadas[-1] == ["launchctl", "kickstart", "gui/501/co.lyatejidos.gestion"]


def test_encender_falla_de_verdad():
    _, ejecutar = registrar_run(codigos={"bootstrap": 5, "kickstart": 113})
    with pytest.raises(ErrorServicio):
        servicio(ejecutar).encender()


def test_apagar():
    llamadas, ejecutar = registrar_run()
    servicio(ejecutar).apagar()
    assert llamadas == [["launchctl", "bootout", "gui/501/co.lyatejidos.gestion"]]


@pytest.mark.parametrize("codigo", [3, 113])
def test_apagar_ya_apagado_no_falla(codigo):
    _, ejecutar = registrar_run(codigos={"bootout": codigo})
    servicio(ejecutar).apagar()


def test_apagar_falla_de_verdad():
    _, ejecutar = registrar_run(codigos={"bootout": 1})
    with pytest.raises(ErrorServicio):
        servicio(ejecutar).apagar()


def test_esperar_hasta_que_responda():
    dormidas = []
    s = servicio(respuestas=[False, False, True], dormidas=dormidas)
    assert s.esperar() is True
    assert len(dormidas) == 2


def test_esperar_se_rinde_a_los_30():
    dormidas = []
    s = servicio(respuestas=[False], dormidas=dormidas)
    assert s.esperar() is False
    assert len(dormidas) == 30
