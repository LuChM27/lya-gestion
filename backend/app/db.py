"""Motor SQLite en modo WAL, sesiones por petición y migraciones con Alembic."""

from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config as ConfigAlembic
from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session

from app.config import Config

CARPETA_MIGRACIONES = Path(__file__).resolve().parent.parent / "migraciones"


def url_base(config: Config) -> str:
    return f"sqlite:///{(config.data_dir / 'lya.db').as_posix()}"


def crear_motor(config: Config) -> Engine:
    motor = create_engine(url_base(config))

    @event.listens_for(motor, "connect")
    def _pragmas(conexion, _registro):
        cursor = conexion.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return motor


def migrar(config: Config) -> None:
    alembic = ConfigAlembic()
    alembic.set_main_option("script_location", str(CARPETA_MIGRACIONES))
    alembic.attributes["url"] = url_base(config)
    command.upgrade(alembic, "head")


def obtener_sesion(request: Request) -> Iterator[Session]:
    with Session(request.app.state.motor) as sesion:
        yield sesion
