"""Modelo de inventario: la existencia es la suma de los movimientos, no una columna."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.modelos import Base

CANTIDAD = Numeric(12, 3)
PRECIO = Numeric(12, 2)


class Modelo(Base):
    __tablename__ = "modelo"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    categoria: Mapped[str] = mapped_column(String(20))
    precio_venta: Mapped[int] = mapped_column(Integer)
    horas_tejido: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    foto: Mapped[str | None] = mapped_column(String(80))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Variante(Base):
    __tablename__ = "variante"
    __table_args__ = (UniqueConstraint("modelo_id", "color"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    modelo_id: Mapped[int] = mapped_column(ForeignKey("modelo.id", ondelete="CASCADE"))
    color: Mapped[str] = mapped_column(String(120))
    sku: Mapped[str] = mapped_column(String(30), unique=True)
    stock_minimo: Mapped[Decimal] = mapped_column(CANTIDAD, default=0)
    foto: Mapped[str | None] = mapped_column(String(80))
    pieza_unica: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Insumo(Base):
    __tablename__ = "insumo"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120), unique=True)
    tipo: Mapped[str] = mapped_column(String(20))
    unidad: Mapped[str] = mapped_column(String(20))
    unidad_compra: Mapped[str | None] = mapped_column(String(20))
    factor_compra: Mapped[Decimal | None] = mapped_column(CANTIDAD)
    stock_minimo: Mapped[Decimal] = mapped_column(CANTIDAD, default=0)
    proveedor: Mapped[str | None] = mapped_column(String(120))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class PrecioInsumo(Base):
    __tablename__ = "precio_insumo"

    id: Mapped[int] = mapped_column(primary_key=True)
    insumo_id: Mapped[int] = mapped_column(ForeignKey("insumo.id", ondelete="CASCADE"), index=True)
    precio_unitario: Mapped[Decimal] = mapped_column(PRECIO)
    desde: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    origen: Mapped[str] = mapped_column(String(20))


class MovimientoInventario(Base):
    __tablename__ = "movimiento_inventario"
    __table_args__ = (
        CheckConstraint(
            "(variante_id IS NULL) != (insumo_id IS NULL)", name="ck_movimiento_un_destino"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    tipo: Mapped[str] = mapped_column(String(20))
    cantidad: Mapped[Decimal] = mapped_column(CANTIDAD)
    costo_unitario: Mapped[Decimal | None] = mapped_column(PRECIO)
    nota: Mapped[str | None] = mapped_column(String(200))
    variante_id: Mapped[int | None] = mapped_column(ForeignKey("variante.id"), index=True)
    insumo_id: Mapped[int | None] = mapped_column(ForeignKey("insumo.id"), index=True)
