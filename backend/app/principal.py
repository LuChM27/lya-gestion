from fastapi import FastAPI

from app import salud
from app.config import Config
from app.version import VERSION


def crear_app(config: Config) -> FastAPI:
    app = FastAPI(title="L&A Gestión", version=VERSION)
    app.state.config = config
    app.include_router(salud.router)
    return app
