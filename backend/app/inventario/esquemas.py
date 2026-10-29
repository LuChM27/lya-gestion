"""Esquemas de entrada y salida del inventario. Los Decimal salen como número JSON."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, StringConstraints

from app.inventario.existencias import Estado

Numero = Annotated[Decimal, PlainSerializer(float, return_type=float)]
Cantidad = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=3)]
CantidadPositiva = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=3)]
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
TextoOpcional = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None
NombreFoto = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{16}\.webp$")] | None
# SQLite guarda la hora UTC sin zona: se envía con Z para que el navegador la convierta.
FechaUTC = Annotated[
    datetime,
    PlainSerializer(lambda d: d.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"), str),
]
Categoria = Literal["crochet", "murano", "cristal", "otro"]


class ModeloEntrada(BaseModel):
    nombre: Texto
    categoria: Categoria
    precio_venta: Annotated[int, Field(ge=0)]
    horas_tejido: Annotated[Decimal, Field(ge=0, max_digits=6, decimal_places=2)] = Decimal(0)
    foto: NombreFoto = None


class VarianteEntrada(BaseModel):
    color: Texto
    sku: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] | None = None
    stock_minimo: Cantidad = Decimal(0)
    foto: NombreFoto = None
    pieza_unica: bool = False


class MovimientoVariante(BaseModel):
    tipo: Literal["ingreso_vitrina", "merma"]
    cantidad: CantidadPositiva
    nota: TextoOpcional = None


class Conteo(BaseModel):
    cantidad_contada: Cantidad
    nota: TextoOpcional = None


class VarianteSalida(BaseModel):
    id: int
    color: str
    sku: str
    stock_minimo: Numero
    foto: str | None
    pieza_unica: bool
    activo: bool
    existencia: Numero
    estado: Estado


class ModeloResumen(BaseModel):
    id: int
    nombre: str
    categoria: str
    precio_venta: int
    foto: str | None
    activo: bool
    unidades: Numero
    variantes: int
    estado: Estado


class ModeloDetalle(ModeloResumen):
    horas_tejido: Numero
    variantes: list[VarianteSalida]  # type: ignore[assignment]


class MovimientoSalida(BaseModel):
    id: int
    fecha: FechaUTC
    tipo: str
    cantidad: Numero
    nota: str | None
