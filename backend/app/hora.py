"""Hora de Bogotá: la base guarda UTC sin zona y los días se cuentan en Colombia."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

BOGOTA = ZoneInfo("America/Bogota")


def hoy_bogota() -> date:
    return datetime.now(BOGOTA).date()


def a_utc(momento: datetime) -> datetime:
    return momento.astimezone(UTC).replace(tzinfo=None)


def limites_del_dia(dia: date) -> tuple[datetime, datetime]:
    inicio = datetime.combine(dia, time(), BOGOTA)
    return a_utc(inicio), a_utc(inicio + timedelta(days=1))
