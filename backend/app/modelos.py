from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario: Mapped[str] = mapped_column(String(80), unique=True)
    hash_contrasena: Mapped[str] = mapped_column(String(200))
    hash_codigo_recuperacion: Mapped[str] = mapped_column(String(200))
    rol: Mapped[str] = mapped_column(String(20), default="duena")
    creado: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Sesion(Base):
    __tablename__ = "sesion"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    expira: Mapped[datetime] = mapped_column(DateTime)
