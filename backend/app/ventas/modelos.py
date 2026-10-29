"""Ventas y dinero: cuentas, transacciones, clientes, pedidos con sus ítems y pagos."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.modelos import Base


def ahora_utc() -> datetime:
    # Con microsegundos: el comprobante usa esta marca en su dirección y debe cambiar en cada cambio.
    return datetime.now(UTC).replace(tzinfo=None)


class Cuenta(Base):
    __tablename__ = "cuenta"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), unique=True)
    saldo_inicial: Mapped[int] = mapped_column(Integer, default=0)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class Categoria(Base):
    __tablename__ = "categoria"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), unique=True)
    tipo: Mapped[str] = mapped_column(String(10))


class Cliente(Base):
    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    whatsapp: Mapped[str | None] = mapped_column(String(30))
    direccion: Mapped[str | None] = mapped_column(String(200))
    ciudad: Mapped[str | None] = mapped_column(String(80))
    instagram: Mapped[str | None] = mapped_column(String(80))
    correo: Mapped[str | None] = mapped_column(String(120))
    cedula: Mapped[str | None] = mapped_column(String(20))
    notas: Mapped[str | None] = mapped_column(String(500))
    es_mostrador: Mapped[bool] = mapped_column(Boolean, default=False)
    creado: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Pedido(Base):
    __tablename__ = "pedido"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora_utc, index=True)
    canal: Mapped[str] = mapped_column(String(20))
    tipo: Mapped[str] = mapped_column(String(20))
    estado: Mapped[str] = mapped_column(String(20))
    cliente_id: Mapped[int] = mapped_column(ForeignKey("cliente.id"))
    descuento: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    nota: Mapped[str | None] = mapped_column(String(200))
    actualizado: Mapped[datetime] = mapped_column(DateTime, default=ahora_utc)


class PedidoItem(Base):
    __tablename__ = "pedido_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedido.id", ondelete="CASCADE"), index=True)
    variante_id: Mapped[int] = mapped_column(ForeignKey("variante.id"))
    cantidad: Mapped[int] = mapped_column(Integer)
    precio_unitario: Mapped[int] = mapped_column(Integer)
    costo_unitario: Mapped[int | None] = mapped_column(Integer)


class Pago(Base):
    __tablename__ = "pago"

    id: Mapped[int] = mapped_column(primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedido.id"), index=True)
    cuenta_id: Mapped[int] = mapped_column(ForeignKey("cuenta.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    monto: Mapped[int] = mapped_column(Integer)


class Transaccion(Base):
    __tablename__ = "transaccion"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    tipo: Mapped[str] = mapped_column(String(15))
    monto: Mapped[int] = mapped_column(Integer)
    descripcion: Mapped[str] = mapped_column(String(200))
    cuenta_id: Mapped[int] = mapped_column(ForeignKey("cuenta.id"))
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categoria.id"))
    pago_id: Mapped[int | None] = mapped_column(ForeignKey("pago.id"), index=True)
