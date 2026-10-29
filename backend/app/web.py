"""Interfaz React compilada, fallback de rutas SPA y reglas de caché para Safari."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response

CACHE_API = "no-store"
CACHE_INDEX = "no-cache"
CACHE_ASSETS = "public, max-age=31536000, immutable"
CACHE_FOTOS = "private, max-age=31536000, immutable"
SIN_INTERFAZ = "La interfaz no está instalada."


def _regla_de_cache(ruta: str) -> str:
    if ruta.startswith("/api/") or ruta == "/api":
        return CACHE_API
    if ruta.startswith("/assets/"):
        return CACHE_ASSETS
    if ruta.startswith("/fotos/"):
        return CACHE_FOTOS
    return CACHE_INDEX


def registrar_web(app: FastAPI, web_dir: Path) -> None:
    raiz = web_dir.resolve()

    @app.middleware("http")
    async def cache(request: Request, call_next) -> Response:
        respuesta = await call_next(request)
        regla = _regla_de_cache(request.url.path)
        if regla in (CACHE_ASSETS, CACHE_FOTOS) and respuesta.status_code != 200:
            regla = CACHE_API  # un 404 o un 401 no se guarda
        respuesta.headers["Cache-Control"] = regla
        return respuesta

    @app.get("/{ruta:path}", include_in_schema=False)
    def interfaz(ruta: str) -> Response:
        if ruta == "api" or ruta.startswith("api/"):
            raise HTTPException(status_code=404)
        index = raiz / "index.html"
        if not index.is_file():
            return PlainTextResponse(SIN_INTERFAZ, status_code=503)
        archivo = (raiz / ruta).resolve()
        if ruta and archivo.is_relative_to(raiz) and archivo.is_file():
            return FileResponse(archivo)
        if ruta.startswith("assets/"):
            # Recurso de una versión anterior: 404, nunca index.html con caché de un año.
            raise HTTPException(status_code=404)
        return FileResponse(index)
