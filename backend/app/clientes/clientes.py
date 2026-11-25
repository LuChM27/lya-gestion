"""Clientes: contactos con WhatsApp normalizado, búsqueda sin tildes y ficha con sus compras."""

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.clientes.esquemas import ClienteEntrada, ClienteFicha, ClienteResumen
from app.db import SesionDB
from app.inventario.existencias import ErrorInventario
from app.inventario.productos import sin_tildes
from app.ventas.modelos import Cliente

router = APIRouter(prefix="/api/clientes", dependencies=[Depends(usuario_actual)])

NO_EXISTE = "Esa clienta no existe."


def normalizar_whatsapp(texto: str) -> str:
    digitos = re.sub(r"\D", "", texto)
    if len(digitos) == 10 and digitos.startswith("3"):
        digitos = "57" + digitos
    if not 7 <= len(digitos) <= 15 or re.search(r"[^\d\s+\-().]", texto):
        raise ErrorInventario("Escribe un WhatsApp válido.")
    return digitos


def _cliente(sesion: Session, cliente_id: int) -> Cliente:
    cliente = sesion.get(Cliente, cliente_id)
    if cliente is None or cliente.es_mostrador:
        raise HTTPException(404, NO_EXISTE)
    return cliente


def _revisar_repetido(sesion: Session, whatsapp: str, propio: int | None) -> None:
    consulta = select(Cliente).where(Cliente.whatsapp == whatsapp, ~Cliente.es_mostrador)
    if propio is not None:
        consulta = consulta.where(Cliente.id != propio)
    otra = sesion.scalars(consulta.order_by(Cliente.activo.desc())).first()
    if otra is None:
        return
    if otra.activo:
        raise HTTPException(409, f"Ya tienes a {otra.nombre} con ese WhatsApp.")
    raise HTTPException(
        409,
        f"{otra.nombre} tiene ese WhatsApp y está archivada: recupérala en «Ver archivadas».",
    )


def _resumen(cliente: Cliente, total: int) -> ClienteResumen:
    return ClienteResumen(
        id=cliente.id,
        nombre=cliente.nombre,
        whatsapp=cliente.whatsapp or "",
        instagram=cliente.instagram,
        total_comprado=total,
        activo=cliente.activo,
    )


def ficha(sesion: Session, cliente: Cliente) -> ClienteFicha:
    return ClienteFicha(
        **_resumen(cliente, 0).model_dump(),
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        correo=cliente.correo,
        cedula=cliente.cedula,
        notas=cliente.notas,
        enlace_whatsapp=f"https://wa.me/{cliente.whatsapp}",
        creado=cliente.creado,
        compras=0,
        por_cobrar=0,
        promedio=0,
        canal_frecuente=None,
        ultima_compra=None,
        historial=[],
    )


def _guardar(sesion: Session, cliente: Cliente, datos: ClienteEntrada) -> None:
    whatsapp = normalizar_whatsapp(datos.whatsapp)
    _revisar_repetido(sesion, whatsapp, cliente.id)
    for campo, valor in datos.model_dump().items():
        setattr(cliente, campo, valor or None)
    cliente.whatsapp = whatsapp


@router.get("")
def listar(sesion: SesionDB, buscar: str = "", archivados: bool = False) -> list[ClienteResumen]:
    clientes = sesion.scalars(
        select(Cliente).where(~Cliente.es_mostrador, Cliente.activo.is_(not archivados))
    ).all()
    texto = sin_tildes(buscar.strip())
    digitos = re.sub(r"\D", "", buscar)

    def coincide(c: Cliente) -> bool:
        if not texto:
            return True
        if texto in sin_tildes(c.nombre) or texto in sin_tildes(c.instagram or ""):
            return True
        return bool(digitos) and digitos in (c.whatsapp or "")

    elegidas = sorted((c for c in clientes if coincide(c)), key=lambda c: sin_tildes(c.nombre))
    return [_resumen(c, 0) for c in elegidas]


@router.post("", status_code=201)
def crear(datos: ClienteEntrada, sesion: SesionDB) -> ClienteFicha:
    cliente = Cliente(es_mostrador=False, activo=True)
    _guardar(sesion, cliente, datos)
    sesion.add(cliente)
    sesion.commit()
    return ficha(sesion, cliente)


@router.get("/{cliente_id}")
def ver(cliente_id: int, sesion: SesionDB) -> ClienteFicha:
    return ficha(sesion, _cliente(sesion, cliente_id))


@router.put("/{cliente_id}")
def editar(cliente_id: int, datos: ClienteEntrada, sesion: SesionDB) -> ClienteFicha:
    cliente = _cliente(sesion, cliente_id)
    _guardar(sesion, cliente, datos)
    sesion.commit()
    return ficha(sesion, cliente)


@router.delete("/{cliente_id}", status_code=204)
def archivar(cliente_id: int, sesion: SesionDB) -> None:
    _cliente(sesion, cliente_id).activo = False
    sesion.commit()


@router.post("/{cliente_id}/restaurar")
def restaurar(cliente_id: int, sesion: SesionDB) -> ClienteFicha:
    cliente = _cliente(sesion, cliente_id)
    _revisar_repetido(sesion, cliente.whatsapp or "", cliente.id)
    cliente.activo = True
    sesion.commit()
    return ficha(sesion, cliente)
