"""Interfaz React compilada, fallback de rutas SPA y reglas de caché para Safari."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response

CACHE_API = "no-store"
CACHE_INDEX = "no-cache"
CACHE_ASSETS = "public, max-age=31536000, immutable"
SIN_INTERFAZ = "La interfaz no está instalada."


def _regla_de_cache(ruta: str) -> str:
    if ruta.startswith("/api/") or ruta == "/api":
        return CACHE_API
    if ruta.startswith("/assets/"):
        return CACHE_ASSETS
    return CACHE_INDEX


def registrar_web(app: FastAPI, web_dir: Path) -> None:
    raiz = web_dir.resolve()

    @app.middleware("http")
    async def cache(request: Request, call_next) -> Response:
        respuesta = await call_next(request)
        respuesta.headers["Cache-Control"] = _regla_de_cache(request.url.path)
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
        return FileResponse(index)
