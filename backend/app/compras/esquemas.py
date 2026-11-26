"""Esquemas de compras de insumos. El total es en pesos enteros."""

from datetime import date
from typing import Annotated

from pydantic import BaseModel, Field

from app.inventario.esquemas import CantidadPositiva, FechaUTC, Numero, Precio, TextoOpcional
from app.ventas.esquemas import CuentaSalida


class ItemCompraEntrada(BaseModel):
    insumo_id: int
    cantidad: CantidadPositiva
    en_unidad_compra: bool = False
    # Precio por la unidad en que se contó (cono o metro).
    precio_unitario: Precio


class CompraEntrada(BaseModel):
    proveedor: TextoOpcional = None
    fecha: date | None = None
    cuenta_id: int | None = None
    nota: TextoOpcional = None
    items: Annotated[list[ItemCompraEntrada], Field(min_length=1, max_length=50)]


class PagoCompra(BaseModel):
    cuenta_id: int
    fecha: date | None = None


class ItemCompraSalida(BaseModel):
    insumo_id: int
    insumo: str
    cantidad: Numero
    unidad: str
    precio_unitario: Numero
    subtotal: int


class CompraSalida(BaseModel):
    id: int
    numero: str
    fecha: FechaUTC
    proveedor: str | None
    total: int
    estado: str
    nota: str | None
    cuenta: CuentaSalida | None
    pagada_el: FechaUTC | None
    items: list[ItemCompraSalida]
