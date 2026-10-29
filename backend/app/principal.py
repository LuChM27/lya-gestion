from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import red, salud
from app.auth import rutas as rutas_auth
from app.auth.limitador import Limitador
from app.config import Config
from app.db import crear_motor
from app.inventario import fotos, insumos, productos
from app.inventario.existencias import ErrorInventario
from app.ventas import comprobante, ventas
from app.version import VERSION
from app.web import registrar_web

DATO_INVALIDO = "Revisa los datos: hay un valor que no es válido."


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
    app.include_router(productos.router)
    app.include_router(insumos.router)
    app.include_router(fotos.router)
    app.include_router(ventas.router)
    app.include_router(comprobante.router)

    @app.exception_handler(ErrorInventario)
    async def error_de_inventario(_: Request, error: ErrorInventario) -> JSONResponse:
        return JSONResponse({"detail": error.mensaje}, status_code=422)

    @app.exception_handler(RequestValidationError)
    async def datos_invalidos(request: Request, error: RequestValidationError) -> JSONResponse:
        # La interfaz muestra detail como texto: en inventario va un mensaje en español.
        if request.url.path.startswith(
            ("/api/inventario", "/api/fotos", "/api/ventas", "/api/cuentas", "/api/pedidos")
        ):
            return JSONResponse({"detail": DATO_INVALIDO}, status_code=422)
        return JSONResponse({"detail": jsonable_encoder(error.errors())}, status_code=422)

    registrar_web(app, config.web_dir)  # al final: su ruta comodín no debe tapar /api
    return app
