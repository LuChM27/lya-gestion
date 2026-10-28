from fastapi import APIRouter

from app.version import VERSION

router = APIRouter()


@router.get("/api/salud")
def salud() -> dict:
    return {"estado": "ok", "version": VERSION, "base": "ok"}
