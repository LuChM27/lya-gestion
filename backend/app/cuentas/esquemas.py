"""Esquemas de Mis cuentas. Los montos son pesos enteros."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.inventario.esquemas import FechaUTC, TextoOpcional

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Monto = Annotated[int, Field(gt=0, le=1_000_000_000)]


class CuentaEntrada(BaseModel):
    nombre: Nombre
    saldo_inicial: Annotated[int, Field(ge=-1_000_000_000, le=1_000_000_000)] = 0


class CuentaSaldo(BaseModel):
    id: int
    nombre: str
    saldo_inicial: int
    saldo: int
    activa: bool


class CategoriaEntrada(BaseModel):
    nombre: Nombre
    tipo: Literal["ingreso", "gasto"]


class CategoriaNombre(BaseModel):
    nombre: Nombre


class CategoriaSalida(BaseModel):
    id: int
    nombre: str
    tipo: str
    activa: bool
    protegida: bool


class MovimientoEntrada(BaseModel):
    tipo: Literal["gasto", "ingreso", "retiro", "transferencia"]
    monto: Monto
    cuenta_id: int
    cuenta_destino_id: int | None = None
    categoria_id: int | None = None
    fecha: date | None = None
    nota: TextoOpcional = None
    gasto_fijo_id: int | None = None


class Origen(BaseModel):
    tipo: Literal["venta", "compra"]
    id: int
    numero: str


class MovimientoSalida(BaseModel):
    id: int
    fecha: FechaUTC
    tipo: str
    descripcion: str
    categoria: str | None
    cuenta: str
    cuenta_destino: str | None
    monto: int
    signo: Literal["+", "-", "="]
    editable: bool
    origen: Origen | None
    nota: str | None
    cuenta_id: int
    cuenta_destino_id: int | None
    categoria_id: int | None
    gasto_fijo_id: int | None


class GastoFijoEntrada(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    monto: Annotated[int, Field(ge=0, le=1_000_000_000)]
    categoria_id: int
    cuenta_id: int | None = None


class GastoFijoSalida(BaseModel):
    id: int
    nombre: str
    monto: int
    categoria_id: int
    categoria: str
    cuenta_id: int | None
    cuenta: str | None
    activo: bool
    registrado_este_mes: bool


class MontoCategoria(BaseModel):
    categoria: str
    monto: int


class SaldoCuenta(BaseModel):
    cuenta: str
    saldo: int


class ResumenMes(BaseModel):
    mes: str
    entro: int
    salio: int
    ganancia: int
    retiros: int
    por_categoria: list[MontoCategoria]
    saldos_al_cierre: list[SaldoCuenta]
