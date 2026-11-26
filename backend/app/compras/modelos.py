"""Compra de insumos: varios ítems (movimientos «compra») y un pago opcional."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.modelos import Base
from app.ventas.modelos import ahora_utc


class Compra(Base):
    __tablename__ = "compra"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora_utc, index=True)
    proveedor: Mapped[str | None] = mapped_column(String(120))
    total: Mapped[int] = mapped_column(Integer)
    # Vacía mientras no se haya pagado.
    cuenta_id: Mapped[int | None] = mapped_column(ForeignKey("cuenta.id"))
    estado: Mapped[str] = mapped_column(String(10), default="activa")
    nota: Mapped[str | None] = mapped_column(String(200))
    actualizado: Mapped[datetime] = mapped_column(DateTime, default=ahora_utc)
