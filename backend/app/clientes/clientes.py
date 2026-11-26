"""Clientes: contactos con WhatsApp normalizado, búsqueda sin tildes y ficha con sus compras."""

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.clientes.esquemas import ClienteEntrada, ClienteFicha, ClienteResumen, CompraCliente
from app.db import SesionDB
from app.inventario.existencias import ErrorInventario
from app.inventario.modelos import Modelo, Variante
from app.inventario.productos import sin_tildes
from app.ventas.modelos import Cliente, Pago, Pedido, PedidoItem
from app.ventas.ventas import numero

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
        f"{otra.nombre} tiene ese WhatsApp y está archivada: recupérala en Clientes.",
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


def _productos(sesion: Session, pedido_ids: list[int]) -> dict[int, list[str]]:
    filas = sesion.execute(
        select(PedidoItem.pedido_id, Modelo.nombre, Variante.color)
        .join(Variante, PedidoItem.variante_id == Variante.id)
        .join(Modelo, Variante.modelo_id == Modelo.id)
        .where(PedidoItem.pedido_id.in_(pedido_ids))
        .order_by(PedidoItem.id)
    ).all()
    productos: dict[int, list[str]] = {}
    for pedido_id, modelo, color in filas:
        productos.setdefault(pedido_id, []).append(f"{modelo} · {color}")
    return productos


def ficha(sesion: Session, cliente: Cliente) -> ClienteFicha:
    pagado = (
        select(Pago.pedido_id, func.sum(Pago.monto).label("monto"))
        .group_by(Pago.pedido_id)
        .subquery()
    )
    filas = sesion.execute(
        select(Pedido, func.coalesce(pagado.c.monto, 0))
        .outerjoin(pagado, pagado.c.pedido_id == Pedido.id)
        .where(Pedido.cliente_id == cliente.id)
        .order_by(Pedido.fecha.desc(), Pedido.id.desc())
    ).all()
    validos = [(p, monto) for p, monto in filas if p.estado != "cancelado"]
    total = sum(p.total for p, _ in validos)
    canales: dict[str, int] = {}
    for p, _ in validos:
        canales[p.canal] = canales.get(p.canal, 0) + 1
    # En empate gana el de la compra más reciente: validos va del más nuevo al más viejo.
    frecuente = max(canales, key=lambda c: canales[c], default=None)
    productos = _productos(sesion, [p.id for p, _ in filas])
    return ClienteFicha(
        **_resumen(cliente, total).model_dump(),
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        correo=cliente.correo,
        cedula=cliente.cedula,
        notas=cliente.notas,
        enlace_whatsapp=f"https://wa.me/{cliente.whatsapp}",
        creado=cliente.creado,
        compras=len(validos),
        por_cobrar=sum(max(p.total - monto, 0) for p, monto in validos),
        promedio=round(total / len(validos)) if validos else 0,
        canal_frecuente=frecuente,
        ultima_compra=validos[0][0].fecha if validos else None,
        historial=[
            CompraCliente(
                id=p.id,
                numero=numero(p.id),
                fecha=p.fecha,
                productos=", ".join(productos.get(p.id, [])),
                total=p.total,
                estado=p.estado,
            )
            for p, _ in filas
        ],
    )


def _confirmar(sesion: Session) -> None:
    try:
        sesion.commit()
    except IntegrityError:
        sesion.rollback()
        raise HTTPException(409, "Ya tienes una clienta con ese WhatsApp.") from None


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
    # Por número solo si no hay letras y son 3 cifras o más: «57» o «Ana 2» no traen a todas.
    digitos = re.sub(r"\D", "", buscar)
    if re.search(r"[^\W\d_]", buscar) or len(digitos) < 3:
        digitos = ""

    def coincide(c: Cliente) -> bool:
        if not texto:
            return True
        if texto in sin_tildes(c.nombre) or texto in sin_tildes(c.instagram or ""):
            return True
        return bool(digitos) and digitos in (c.whatsapp or "")

    elegidas = sorted((c for c in clientes if coincide(c)), key=lambda c: sin_tildes(c.nombre))
    totales = dict(
        sesion.execute(
            select(Pedido.cliente_id, func.sum(Pedido.total))
            .where(Pedido.estado != "cancelado")
            .group_by(Pedido.cliente_id)
        ).all()
    )
    return [_resumen(c, totales.get(c.id, 0)) for c in elegidas]


@router.post("", status_code=201)
def crear(datos: ClienteEntrada, sesion: SesionDB) -> ClienteFicha:
    cliente = Cliente(es_mostrador=False, activo=True)
    _guardar(sesion, cliente, datos)
    sesion.add(cliente)
    _confirmar(sesion)
    return ficha(sesion, cliente)


@router.get("/{cliente_id}")
def ver(cliente_id: int, sesion: SesionDB) -> ClienteFicha:
    return ficha(sesion, _cliente(sesion, cliente_id))


@router.put("/{cliente_id}")
def editar(cliente_id: int, datos: ClienteEntrada, sesion: SesionDB) -> ClienteFicha:
    cliente = _cliente(sesion, cliente_id)
    _guardar(sesion, cliente, datos)
    _confirmar(sesion)
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
    _confirmar(sesion)
    return ficha(sesion, cliente)
