from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.version import VERSION

router = APIRouter()


@router.get("/api/salud")
def salud(request: Request) -> JSONResponse:
    try:
        with request.app.state.motor.connect() as conexion:
            conexion.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            {"estado": "error", "version": VERSION, "base": "error"}, status_code=503
        )
    return JSONResponse({"estado": "ok", "version": VERSION, "base": "ok"})
