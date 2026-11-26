"""Hora de Bogotá: la base guarda UTC sin zona y los días se cuentan en Colombia."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

BOGOTA = ZoneInfo("America/Bogota")


def hoy_bogota() -> date:
    return datetime.now(BOGOTA).date()


def a_utc(momento: datetime) -> datetime:
    return momento.astimezone(UTC).replace(tzinfo=None)


def limites_del_dia(dia: date) -> tuple[datetime, datetime]:
    inicio = datetime.combine(dia, time(), BOGOTA)
    return a_utc(inicio), a_utc(inicio + timedelta(days=1))


def fecha_de_registro(dia: date | None) -> datetime:
    """Fecha para guardar algo registrado hoy o anotado otro día (venta de feria, gasto, compra)."""
    hoy = hoy_bogota()
    if dia is not None and dia > hoy:
        raise HTTPException(422, "La fecha no puede ser futura.")
    if dia is None or dia == hoy:
        return datetime.now(UTC).replace(tzinfo=None)
    # Anotado en el cuaderno y registrado después: se ubica al mediodía de ese día.
    return a_utc(datetime.combine(dia, time(12), BOGOTA))
