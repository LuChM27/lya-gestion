from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import salud
from app.config import Config
from app.db import crear_motor
from app.version import VERSION


def crear_app(config: Config) -> FastAPI:
    @asynccontextmanager
    async def ciclo_de_vida(app: FastAPI):
        yield
        app.state.motor.dispose()

    app = FastAPI(title="L&A Gestión", version=VERSION, lifespan=ciclo_de_vida)
    app.state.config = config
    app.state.motor = crear_motor(config)
    app.include_router(salud.router)
    return app
