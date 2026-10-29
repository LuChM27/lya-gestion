import subprocess
from pathlib import Path

from app import lanzador
from app.lanzador import URL, abrir, abrir_url, diagnostico
from tests.test_servicio import registrar_run, servicio


def test_abrir_encendido_no_toca_launchctl():
    llamadas, ejecutar = registrar_run()
    abiertas = []
    assert abrir(servicio(ejecutar, respuestas=[True]), abiertas.append) == 0
    assert llamadas == [] and abiertas == [URL]


def test_abrir_apagado_enciende_y_abre():
    llamadas, ejecutar = registrar_run()
    abiertas = []
    s = servicio(ejecutar, respuestas=[False, False, True])
    assert abrir(s, abiertas.append) == 0
    assert llamadas[0][1] == "bootstrap" and abiertas == [URL]


def test_abrir_falla_devuelve_1_sin_abrir():
    _, ejecutar = registrar_run()
    abiertas = []
    assert abrir(servicio(ejecutar, respuestas=[False]), abiertas.append) == 1
    assert abiertas == []


def test_abrir_si_launchctl_falla_devuelve_1():
    _, ejecutar = registrar_run(codigos={"bootstrap": 5, "kickstart": 113})
    assert abrir(servicio(ejecutar, respuestas=[False]), lambda _u: None) == 1


def test_diagnostico(tmp_path):
    registros = tmp_path / "registros"
    registros.mkdir()
    lineas = [f"línea {i}" for i in range(50)]
    lineas.append("El puerto 8080 está ocupado por otro programa.")
    (registros / "servicio.log").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    texto = diagnostico(servicio(respuestas=[False]), registros)
    assert "Versión: 0.1.0" in texto and "Servicio: no responde" in texto
    assert "El puerto 8080 está ocupado" in texto
    assert "línea 31" in texto and "línea 30\n" not in texto


def test_diagnostico_sin_registro(tmp_path):
    texto = diagnostico(servicio(respuestas=[True]), tmp_path / "registros")
    assert "Servicio: responde" in texto and "(sin registro)" in texto


def test_abrir_url_con_chrome():
    llamadas = []

    def ejecutar(args, **_):
        llamadas.append(args)
        return subprocess.CompletedProcess(args, 0)

    abrir_url(URL, existe=lambda _p: True, ejecutar=ejecutar)
    assert llamadas == [["open", "-na", "Google Chrome", "--args", f"--app={URL}"]]


def test_abrir_url_sin_chrome():
    llamadas = []

    def ejecutar(args, **_):
        llamadas.append(args)
        return subprocess.CompletedProcess(args, 0)

    abrir_url(URL, existe=lambda _p: False, ejecutar=ejecutar)
    assert llamadas == [["open", URL]]


def test_url():
    assert URL == "http://localhost:8080"
    assert lanzador.CHROME == Path("/Applications/Google Chrome.app")


def test_diagnostico_lee_solo_el_final(tmp_path, monkeypatch):
    registros = tmp_path / "registros"
    registros.mkdir()
    with (registros / "servicio.log").open("w", encoding="utf-8") as f:
        f.write("ruido\n" * 200_000)
        f.write("Traceback: fallo real\n")

    def prohibido(*_a, **_k):
        raise AssertionError("no debe leer el registro completo")

    monkeypatch.setattr(Path, "read_text", prohibido)
    texto = diagnostico(servicio(respuestas=[False]), registros)
    assert "Traceback: fallo real" in texto
