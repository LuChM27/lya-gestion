"""Esquemas de la venta rápida. Los montos son pesos enteros."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.inventario.esquemas import FechaUTC, TextoOpcional

Canal = Literal["instagram", "tiktok", "whatsapp", "feria", "presencial"]


class CuentaSalida(BaseModel):
    id: int
    nombre: str


class CatalogoItem(BaseModel):
    variante_id: int
    modelo_id: int
    nombre: str
    color: str
    sku: str
    foto: str | None
    categoria: str
    precio: int
    existencia: int


class ItemEntrada(BaseModel):
    variante_id: int
    cantidad: Annotated[int, Field(ge=1, le=1000)]


class VentaEntrada(BaseModel):
    canal: Canal
    cuenta_id: int
    descuento: Annotated[int, Field(ge=0)] = 0
    fecha: date | None = None
    nota: TextoOpcional = None
    items: Annotated[list[ItemEntrada], Field(min_length=1, max_length=50)]


class ItemSalida(BaseModel):
    variante_id: int
    modelo: str
    color: str
    cantidad: int
    precio_unitario: int
    subtotal: int


class VentaSalida(BaseModel):
    id: int
    numero: str
    fecha: FechaUTC
    canal: str
    estado: str
    cliente: str
    cuenta: CuentaSalida | None
    items: list[ItemSalida]
    subtotal: int
    descuento: int
    total: int
    comprobante: str


class DiaVentas(BaseModel):
    dia: date
    ventas: list[VentaSalida]
    total: int
    cantidad: int
