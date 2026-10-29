"""Cifras de la pantalla de Inicio: ventas del día y del mes, vitrina y avisos de stock."""

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.db import SesionDB
from app.hora import hoy_bogota, limites_del_dia
from app.inventario.existencias import cantidad_texto, estado_stock, existencias
from app.inventario.modelos import Insumo, Modelo, Variante
from app.inventario.productos import GRAVEDAD, sin_tildes
from app.ventas.modelos import Pedido

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])

MESES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)
MAX_AVISOS = 5


class VentasHoy(BaseModel):
    total: int
    cantidad: int
    por_canal: dict[str, int]


class VentasMes(BaseModel):
    total: int
    cantidad: int
    mes: str


class Vitrina(BaseModel):
    piezas: int
    valor: int


class Aviso(BaseModel):
    tipo: str
    id: int
    nombre: str
    detalle: str
    estado: str


class Inicio(BaseModel):
    ventas_hoy: VentasHoy
    ventas_mes: VentasMes
    vitrina: Vitrina
    avisos: list[Aviso]


def _ventas(sesion: Session, desde: date, hasta: date) -> list[Pedido]:
    inicio, _ = limites_del_dia(desde)
    _, fin = limites_del_dia(hasta)
    return list(
        sesion.scalars(
            select(Pedido).where(
                Pedido.tipo == "inmediata",
                Pedido.estado != "cancelado",
                Pedido.fecha >= inicio,
                Pedido.fecha < fin,
            )
        )
    )


@router.get("/inicio")
def inicio(sesion: SesionDB) -> Inicio:
    hoy = hoy_bogota()
    de_hoy = _ventas(sesion, hoy, hoy)
    del_mes = _ventas(sesion, hoy.replace(day=1), hoy)
    por_canal: dict[str, int] = {}
    for p in de_hoy:
        por_canal[p.canal] = por_canal.get(p.canal, 0) + 1

    variantes = sesion.execute(
        select(Variante, Modelo)
        .join(Modelo, Variante.modelo_id == Modelo.id)
        .where(Variante.activo, Modelo.activo)
    ).all()
    stock = existencias(sesion, variantes=[v.id for v, _ in variantes])
    insumos = list(sesion.scalars(select(Insumo).where(Insumo.activo)))
    stock_insumos = existencias(sesion, insumos=[i.id for i in insumos])

    avisos = []
    for v, m in variantes:
        estado = estado_stock(stock[v.id], v.stock_minimo)
        if estado != "ok":
            avisos.append(
                Aviso(
                    tipo="producto",
                    id=m.id,
                    nombre=f"{m.nombre} · {v.color}",
                    detalle=f"Quedan {cantidad_texto(stock[v.id])} · mínimo {cantidad_texto(v.stock_minimo)}",
                    estado=estado,
                )
            )
    for i in insumos:
        estado = estado_stock(stock_insumos[i.id], i.stock_minimo)
        if estado != "ok":
            avisos.append(
                Aviso(
                    tipo="insumo",
                    id=i.id,
                    nombre=i.nombre,
                    detalle=(
                        f"Quedan {cantidad_texto(stock_insumos[i.id])} {i.unidad}"
                        f" · mínimo {cantidad_texto(i.stock_minimo)}"
                    ),
                    estado=estado,
                )
            )
    avisos.sort(key=lambda a: (GRAVEDAD[a.estado], sin_tildes(a.nombre)))

    return Inicio(
        ventas_hoy=VentasHoy(
            total=sum(p.total for p in de_hoy), cantidad=len(de_hoy), por_canal=por_canal
        ),
        ventas_mes=VentasMes(
            total=sum(p.total for p in del_mes), cantidad=len(del_mes), mes=MESES[hoy.month - 1]
        ),
        vitrina=Vitrina(
            piezas=int(sum((max(stock[v.id], 0) for v, _ in variantes), start=0)),
            valor=int(sum((max(stock[v.id], 0) * m.precio_venta for v, m in variantes), start=0)),
        ),
        avisos=avisos[:MAX_AVISOS],
    )
