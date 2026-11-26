"""Movimientos de dinero (gasto, otro ingreso, retiro, transferencia), gastos fijos y resumen del mes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.cuentas.esquemas import (
    MovimientoEntrada,
    MovimientoSalida,
    Origen,
)
from app.cuentas.saldos import mes_utc
from app.db import SesionDB
from app.hora import fecha_de_registro, hoy_bogota
from app.ventas.modelos import Categoria, Cuenta, GastoFijo, Pago, Transaccion

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])

TIPO_TRANSACCION = {
    "gasto": "egreso",
    "retiro": "egreso",
    "ingreso": "ingreso",
    "transferencia": "transferencia",
}


def numero(id_: int) -> str:
    return f"{id_:04d}"


def _origen(sesion: Session, t: Transaccion) -> Origen | None:
    if t.pago_id is not None:
        pedido_id = sesion.scalar(select(Pago.pedido_id).where(Pago.id == t.pago_id))
        return Origen(tipo="venta", id=pedido_id, numero=numero(pedido_id))
    if t.compra_id is not None:
        return Origen(tipo="compra", id=t.compra_id, numero=numero(t.compra_id))
    return None


def _salida(sesion: Session, t: Transaccion) -> MovimientoSalida:
    cuenta = sesion.get(Cuenta, t.cuenta_id)
    destino = sesion.get(Cuenta, t.cuenta_destino_id) if t.cuenta_destino_id else None
    categoria = sesion.get(Categoria, t.categoria_id) if t.categoria_id else None
    origen = _origen(sesion, t)
    signo = {"ingreso": "+", "egreso": "-"}.get(t.tipo, "=")
    return MovimientoSalida(
        id=t.id,
        fecha=t.fecha,
        tipo=t.tipo,
        descripcion=t.descripcion,
        categoria=categoria.nombre if categoria else None,
        cuenta=cuenta.nombre,
        cuenta_destino=destino.nombre if destino else None,
        monto=t.monto,
        signo=signo,
        editable=origen is None,
        origen=origen,
    )


def _cuenta_activa(sesion: Session, cuenta_id: int | None) -> Cuenta:
    cuenta = sesion.get(Cuenta, cuenta_id) if cuenta_id is not None else None
    if cuenta is None or not cuenta.activa:
        raise HTTPException(422, "Elige una cuenta.")
    return cuenta


def _por_nombre(sesion: Session, nombre: str) -> Categoria:
    return sesion.scalars(select(Categoria).where(Categoria.nombre == nombre)).one()


def _llenar(
    sesion: Session, t: Transaccion, datos: MovimientoEntrada, fecha: datetime | None
) -> None:
    cuenta = _cuenta_activa(sesion, datos.cuenta_id)
    destino = None
    categoria = None
    if datos.tipo == "transferencia":
        destino = _cuenta_activa(sesion, datos.cuenta_destino_id)
        if destino.id == cuenta.id:
            raise HTTPException(422, "Elige dos cuentas distintas.")
    elif datos.tipo == "retiro":
        categoria = _por_nombre(sesion, "Retiro personal")
    else:
        categoria = sesion.get(Categoria, datos.categoria_id) if datos.categoria_id else None
        esperado = "gasto" if datos.tipo == "gasto" else "ingreso"
        if (
            categoria is None
            or not categoria.activa
            or categoria.tipo != esperado
            or categoria.nombre == "Ventas"
        ):
            raise HTTPException(422, "Elige una categoría.")
    gasto_fijo = None
    if datos.gasto_fijo_id is not None:
        gasto_fijo = sesion.get(GastoFijo, datos.gasto_fijo_id)
        if gasto_fijo is None:
            raise HTTPException(422, "Ese gasto fijo no existe.")
    t.tipo = TIPO_TRANSACCION[datos.tipo]
    t.monto = datos.monto
    t.cuenta_id = cuenta.id
    t.cuenta_destino_id = destino.id if destino else None
    t.categoria_id = categoria.id if categoria else None
    t.nota = datos.nota
    t.gasto_fijo_id = gasto_fijo.id if gasto_fijo else None
    if destino is not None:
        t.descripcion = datos.nota or f"Pasé a {destino.nombre}"
    else:
        t.descripcion = datos.nota or (gasto_fijo.nombre if gasto_fijo else categoria.nombre)
    if fecha is not None:
        t.fecha = fecha


def _manual(sesion: Session, movimiento_id: int) -> Transaccion:
    t = sesion.get(Transaccion, movimiento_id)
    if t is None:
        raise HTTPException(404, "Ese movimiento no existe.")
    origen = _origen(sesion, t)
    if origen is not None:
        de = "la venta" if origen.tipo == "venta" else "la compra"
        raise HTTPException(
            409, f"Este movimiento viene de {de} N.º {origen.numero}: cámbialo desde allá."
        )
    return t


@router.get("/movimientos")
def listar_movimientos(
    sesion: SesionDB, mes: str = "", cuenta_id: int | None = None
) -> list[MovimientoSalida]:
    inicio, fin = mes_utc(mes or hoy_bogota().strftime("%Y-%m"))
    consulta = select(Transaccion).where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
    if cuenta_id is not None:
        consulta = consulta.where(
            or_(Transaccion.cuenta_id == cuenta_id, Transaccion.cuenta_destino_id == cuenta_id)
        )
    filas = sesion.scalars(consulta.order_by(Transaccion.fecha.desc(), Transaccion.id.desc()))
    return [_salida(sesion, t) for t in filas]


@router.post("/movimientos", status_code=201)
def crear_movimiento(datos: MovimientoEntrada, sesion: SesionDB) -> MovimientoSalida:
    t = Transaccion()
    _llenar(sesion, t, datos, fecha_de_registro(datos.fecha))
    sesion.add(t)
    sesion.commit()
    return _salida(sesion, t)


@router.put("/movimientos/{movimiento_id}")
def editar_movimiento(
    movimiento_id: int, datos: MovimientoEntrada, sesion: SesionDB
) -> MovimientoSalida:
    t = _manual(sesion, movimiento_id)
    _llenar(sesion, t, datos, fecha_de_registro(datos.fecha) if datos.fecha else None)
    sesion.commit()
    return _salida(sesion, t)


@router.delete("/movimientos/{movimiento_id}", status_code=204)
def borrar_movimiento(movimiento_id: int, sesion: SesionDB) -> None:
    sesion.delete(_manual(sesion, movimiento_id))
    sesion.commit()
