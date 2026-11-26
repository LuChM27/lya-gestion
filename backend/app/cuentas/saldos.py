"""Saldos calculados desde las transacciones (nunca guardados) y límites de un mes en Bogotá."""

import re
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.hora import BOGOTA, a_utc
from app.ventas.modelos import Cuenta, Transaccion


def saldos(sesion: Session, hasta: datetime | None = None) -> dict[int, int]:
    """Saldo de cada cuenta con las transacciones de fecha < hasta (todas si no hay hasta)."""
    filtro = [Transaccion.fecha < hasta] if hasta is not None else []
    efecto = case(
        (Transaccion.tipo == "ingreso", Transaccion.monto),
        else_=-Transaccion.monto,  # egresos y transferencias que salen
    )
    salidas = dict(
        sesion.execute(
            select(Transaccion.cuenta_id, func.sum(efecto))
            .where(*filtro)
            .group_by(Transaccion.cuenta_id)
        ).all()
    )
    entradas = dict(
        sesion.execute(
            select(Transaccion.cuenta_destino_id, func.sum(Transaccion.monto))
            .where(Transaccion.tipo == "transferencia", *filtro)
            .group_by(Transaccion.cuenta_destino_id)
        ).all()
    )
    return {
        c.id: c.saldo_inicial + (salidas.get(c.id) or 0) + (entradas.get(c.id) or 0)
        for c in sesion.scalars(select(Cuenta))
    }


def mes_utc(mes: str) -> tuple[datetime, datetime]:
    """«2026-11» → inicio y fin del mes en hora de Bogotá, pasados a UTC sin zona."""
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", mes):
        raise HTTPException(422, "Elige un mes válido.")
    anio, numero = int(mes[:4]), int(mes[5:])
    siguiente = (anio + 1, 1) if numero == 12 else (anio, numero + 1)
    inicio = datetime(anio, numero, 1, tzinfo=BOGOTA)
    fin = datetime(*siguiente, 1, tzinfo=BOGOTA)
    return a_utc(inicio), a_utc(fin)
