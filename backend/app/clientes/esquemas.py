"""Esquemas de clientes. Los montos son pesos enteros."""

from pydantic import BaseModel

from app.inventario.esquemas import FechaUTC, Texto, TextoOpcional


class ClienteEntrada(BaseModel):
    nombre: Texto
    whatsapp: str
    direccion: TextoOpcional = None
    ciudad: TextoOpcional = None
    instagram: TextoOpcional = None
    correo: TextoOpcional = None
    cedula: TextoOpcional = None
    notas: TextoOpcional = None


class ClienteResumen(BaseModel):
    id: int
    nombre: str
    whatsapp: str
    instagram: str | None
    total_comprado: int
    activo: bool


class CompraCliente(BaseModel):
    id: int
    numero: str
    fecha: FechaUTC
    productos: str
    total: int
    estado: str


class ClienteFicha(ClienteResumen):
    direccion: str | None
    ciudad: str | None
    correo: str | None
    cedula: str | None
    notas: str | None
    enlace_whatsapp: str
    creado: FechaUTC
    compras: int
    por_cobrar: int
    promedio: int
    canal_frecuente: str | None
    ultima_compra: FechaUTC | None
    historial: list[CompraCliente]
