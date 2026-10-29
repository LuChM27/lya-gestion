"""Existencias calculadas como suma de movimientos, conteos y estado de stock."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.inventario.modelos import MovimientoInventario

TIPOS = frozenset(
    {
        "compra",
        "inicio_produccion",
        "consumo",
        "liberacion",
        "ingreso_vitrina",
        "venta",
        "devolucion",
        "anulacion",
        "cambio",
        "ajuste",
        "merma",
    }
)
MILESIMA = Decimal("0.001")
Estado = Literal["ok", "por_agotarse", "bajo_minimo"]


class ErrorInventario(Exception):
    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


def _redondear(d: Decimal | float | None) -> Decimal:
    # SQLite suma en coma flotante: se vuelve a llevar a 3 decimales.
    return Decimal(str(d or 0)).quantize(MILESIMA)


def _filtro(variante_id: int | None, insumo_id: int | None):
    if (variante_id is None) == (insumo_id is None):
        raise ValueError("Indica variante_id o insumo_id, no ambos.")
    if variante_id is not None:
        return MovimientoInventario.variante_id == variante_id
    return MovimientoInventario.insumo_id == insumo_id


def existencia(
    sesion: Session, *, variante_id: int | None = None, insumo_id: int | None = None
) -> Decimal:
    total = sesion.scalar(
        select(func.sum(MovimientoInventario.cantidad)).where(_filtro(variante_id, insumo_id))
    )
    return _redondear(total)


def existencias(
    sesion: Session, *, variantes: list[int] | None = None, insumos: list[int] | None = None
) -> dict[int, Decimal]:
    if (variantes is None) == (insumos is None):
        raise ValueError("Indica variantes o insumos, no ambos.")
    columna = (
        MovimientoInventario.variante_id
        if variantes is not None
        else MovimientoInventario.insumo_id
    )
    ids = variantes if variantes is not None else insumos
    resultado = {i: Decimal("0.000") for i in ids}
    if ids:
        filas = sesion.execute(
            select(columna, func.sum(MovimientoInventario.cantidad))
            .where(columna.in_(ids))
            .group_by(columna)
        )
        for clave, total in filas:
            resultado[clave] = _redondear(total)
    return resultado


def estado_stock(existencia: Decimal, minimo: Decimal) -> Estado:
    if existencia < minimo or existencia < 0:
        return "bajo_minimo"
    if minimo > 0 and existencia <= minimo * Decimal("1.25"):
        return "por_agotarse"
    return "ok"


def cantidad_texto(d: Decimal) -> str:
    d = _redondear(d).normalize()
    texto = f"{d:,f}"  # 1,234.5
    return texto.replace(",", "_").replace(".", ",").replace("_", ".")


def registrar_movimiento(
    sesion: Session,
    *,
    tipo: str,
    cantidad: Decimal,
    variante_id: int | None = None,
    insumo_id: int | None = None,
    costo_unitario: Decimal | None = None,
    nota: str | None = None,
    permitir_negativo: bool = False,
    unidad: str | None = None,
    pedido_id: int | None = None,
    fecha: datetime | None = None,
) -> MovimientoInventario:
    if tipo not in TIPOS:
        raise ValueError(f"Tipo de movimiento desconocido: {tipo}")
    cantidad = _redondear(cantidad)
    if cantidad == 0:
        raise ErrorInventario("La cantidad no puede ser 0.")
    movimiento = MovimientoInventario(
        tipo=tipo,
        cantidad=cantidad,
        variante_id=variante_id,
        insumo_id=insumo_id,
        costo_unitario=costo_unitario,
        nota=nota,
        pedido_id=pedido_id,
    )
    if fecha is not None:
        movimiento.fecha = fecha
    sesion.add(movimiento)
    sesion.flush()
    if cantidad < 0 and not permitir_negativo:
        # Se revisa después de escribir: SQLite ya dio el bloqueo de escritura a esta
        # sesión, así que otra merma simultánea espera y luego ve esta.
        despues = existencia(sesion, variante_id=variante_id, insumo_id=insumo_id)
        if despues < 0:
            sesion.delete(movimiento)
            sesion.flush()
            antes = cantidad_texto(despues - cantidad)
            raise ErrorInventario(f"Solo hay {antes} {unidad}." if unidad else f"Solo hay {antes}.")
    return movimiento


def contar(
    sesion: Session,
    *,
    cantidad_contada: Decimal,
    variante_id: int | None = None,
    insumo_id: int | None = None,
    nota: str | None = None,
) -> MovimientoInventario | None:
    if cantidad_contada < 0:
        raise ErrorInventario("El conteo no puede ser negativo.")
    diferencia = _redondear(cantidad_contada) - existencia(
        sesion, variante_id=variante_id, insumo_id=insumo_id
    )
    if diferencia == 0:
        return None
    return registrar_movimiento(
        sesion,
        tipo="ajuste",
        cantidad=diferencia,
        variante_id=variante_id,
        insumo_id=insumo_id,
        nota=nota,
        permitir_negativo=True,
    )
