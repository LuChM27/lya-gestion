from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import red, salud
from app.auth import rutas as rutas_auth
from app.auth.limitador import Limitador
from app.config import Config
from app.db import crear_motor
from app.version import VERSION
from app.web import registrar_web


def crear_app(config: Config) -> FastAPI:
    @asynccontextmanager
    async def ciclo_de_vida(app: FastAPI):
        yield
        app.state.motor.dispose()

    app = FastAPI(title="L&A Gestión", version=VERSION, lifespan=ciclo_de_vida)
    app.state.config = config
    app.state.motor = crear_motor(config)
    app.state.limitador = Limitador()
    app.state.ip_local = red.ip_local
    app.include_router(salud.router)
    app.include_router(rutas_auth.router)
    app.include_router(red.router)
    registrar_web(app, config.web_dir)  # al final: su ruta comodín no debe tapar /api
    return app
