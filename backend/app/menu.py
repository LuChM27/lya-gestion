"""Ícono de la barra de menú: estado, abrir, encender, apagar y diagnóstico (solo macOS).

Lo arranca launchd con co.lyatejidos.menu: python -m app.menu
"""

import subprocess

from app import lanzador
from app.servicio import ErrorServicio, Servicio

CONFIRMAR_APAGADO = (
    "Si la apagas, el celular no podrá entrar hasta que la enciendas o reinicies la Mac."
)
SEGUNDOS_ENTRE_REVISIONES = 10


def estado_texto(responde: bool) -> str:
    return "L&A encendida" if responde else "L&A apagada"


def main() -> None:
    # Importaciones de macOS aquí para que las pruebas corran en cualquier sistema.
    import AppKit
    import rumps

    servicio = Servicio.predeterminado()
    app = rumps.App("L&A", quit_button=None)
    estado = rumps.MenuItem(estado_texto(servicio.responde()))

    def actualizar(_=None):
        estado.title = estado_texto(servicio.responde())

    def abrir(_):
        if lanzador.abrir(servicio, lanzador.abrir_url) != 0:
            rumps.alert("L&A no pudo arrancar.", "Usa «Copiar diagnóstico» y envíaselo a Luciano.")
        actualizar()

    def encender(_):
        try:
            servicio.encender()
            servicio.esperar()
        except ErrorServicio:
            rumps.alert("L&A no pudo encenderse.", "Usa «Copiar diagnóstico» y envíaselo a Luciano.")
        actualizar()

    def apagar(_):
        if rumps.alert("¿Apagar L&A?", CONFIRMAR_APAGADO, ok="Apagar", cancel="Cancelar") != 1:
            return
        try:
            servicio.apagar()
        except ErrorServicio:
            rumps.alert("L&A no pudo apagarse.", "Usa «Copiar diagnóstico» y envíaselo a Luciano.")
        actualizar()

    def copiar_diagnostico(_):
        texto = lanzador.diagnostico(servicio, lanzador.REGISTROS)
        subprocess.run(["pbcopy"], input=texto, text=True)
        rumps.alert("Diagnóstico copiado.", "Pégalo en WhatsApp para Luciano.")

    app.menu = [
        estado,
        None,
        rumps.MenuItem("Abrir L&A", callback=abrir),
        rumps.MenuItem("Encender L&A", callback=encender),
        rumps.MenuItem("Apagar L&A", callback=apagar),
        None,
        rumps.MenuItem("Copiar diagnóstico", callback=copiar_diagnostico),
    ]
    rumps.Timer(actualizar, SEGUNDOS_ENTRE_REVISIONES).start()
    # Accesoria: ícono solo en la barra de menú, sin ícono de Python en el Dock.
    AppKit.NSApplication.sharedApplication().setActivationPolicy_(
        AppKit.NSApplicationActivationPolicyAccessory
    )
    app.run()


if __name__ == "__main__":
    main()
