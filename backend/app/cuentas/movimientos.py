"""Movimientos de dinero (gasto, otro ingreso, retiro, transferencia), gastos fijos y resumen del mes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.cuentas.esquemas import (
    GastoFijoEntrada,
    GastoFijoSalida,
    MontoCategoria,
    MovimientoEntrada,
    MovimientoSalida,
    Origen,
    ResumenMes,
    SaldoCuenta,
)
from app.cuentas.saldos import mes_utc, saldos
from app.db import SesionDB
from app.hora import fecha_de_registro, hoy_bogota
from app.inventario.productos import sin_tildes
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
        nota=t.nota,
        cuenta_id=t.cuenta_id,
        cuenta_destino_id=t.cuenta_destino_id,
        categoria_id=t.categoria_id,
        gasto_fijo_id=t.gasto_fijo_id,
    )


def _cuenta_activa(sesion: Session, cuenta_id: int | None, ya_tenia: tuple = ()) -> Cuenta:
    """Cuenta activa, o la que el movimiento ya tenía aunque luego se haya archivado."""
    cuenta = sesion.get(Cuenta, cuenta_id) if cuenta_id is not None else None
    if cuenta is None or not (cuenta.activa or cuenta.id in ya_tenia):
        raise HTTPException(422, "Elige una cuenta.")
    return cuenta


def _por_nombre(sesion: Session, nombre: str) -> Categoria:
    return sesion.scalars(select(Categoria).where(Categoria.nombre == nombre)).one()


def _llenar(
    sesion: Session, t: Transaccion, datos: MovimientoEntrada, fecha: datetime | None
) -> None:
    # Al editar, lo que ya tenía sigue valiendo aunque se haya archivado después.
    tenia = (t.cuenta_id, t.cuenta_destino_id) if t.id is not None else ()
    cuenta = _cuenta_activa(sesion, datos.cuenta_id, tenia)
    destino = None
    categoria = None
    if datos.tipo == "transferencia":
        destino = _cuenta_activa(sesion, datos.cuenta_destino_id, tenia)
        if destino.id == cuenta.id:
            raise HTTPException(422, "Elige dos cuentas distintas.")
    elif datos.tipo == "retiro":
        categoria = _por_nombre(sesion, "Retiro personal")
    else:
        categoria = sesion.get(Categoria, datos.categoria_id) if datos.categoria_id else None
        esperado = "gasto" if datos.tipo == "gasto" else "ingreso"
        if (
            categoria is None
            or not (categoria.activa or categoria.id == t.categoria_id)
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


def _registrados(sesion: Session, mes: str) -> set[int]:
    inicio, fin = mes_utc(mes)
    return set(
        sesion.scalars(
            select(Transaccion.gasto_fijo_id).where(
                Transaccion.gasto_fijo_id.is_not(None),
                Transaccion.fecha >= inicio,
                Transaccion.fecha < fin,
            )
        )
    )


def _fijo_salida(sesion: Session, f: GastoFijo, registrados: set[int]) -> GastoFijoSalida:
    cuenta = sesion.get(Cuenta, f.cuenta_id) if f.cuenta_id else None
    return GastoFijoSalida(
        id=f.id,
        nombre=f.nombre,
        monto=f.monto,
        categoria_id=f.categoria_id,
        categoria=sesion.get(Categoria, f.categoria_id).nombre,
        cuenta_id=f.cuenta_id,
        cuenta=cuenta.nombre if cuenta else None,
        activo=f.activo,
        registrado_este_mes=f.id in registrados,
    )


def _llenar_fijo(sesion: Session, f: GastoFijo, datos: GastoFijoEntrada) -> None:
    categoria = sesion.get(Categoria, datos.categoria_id)
    if categoria is None or not categoria.activa or categoria.tipo != "gasto":
        raise HTTPException(422, "Elige una categoría.")
    if datos.cuenta_id is not None:
        _cuenta_activa(sesion, datos.cuenta_id)
    f.nombre, f.monto, f.categoria_id, f.cuenta_id = (
        datos.nombre,
        datos.monto,
        datos.categoria_id,
        datos.cuenta_id,
    )


def _fijo(sesion: Session, fijo_id: int) -> GastoFijo:
    f = sesion.get(GastoFijo, fijo_id)
    if f is None:
        raise HTTPException(404, "Ese gasto fijo no existe.")
    return f


@router.get("/gastos-fijos")
def listar_fijos(sesion: SesionDB) -> list[GastoFijoSalida]:
    registrados = _registrados(sesion, hoy_bogota().strftime("%Y-%m"))
    fijos = sorted(
        sesion.scalars(select(GastoFijo).where(GastoFijo.activo)),
        key=lambda f: sin_tildes(f.nombre),
    )
    return [_fijo_salida(sesion, f, registrados) for f in fijos]


@router.post("/gastos-fijos", status_code=201)
def crear_fijo(datos: GastoFijoEntrada, sesion: SesionDB) -> GastoFijoSalida:
    f = GastoFijo(activo=True)
    _llenar_fijo(sesion, f, datos)
    sesion.add(f)
    sesion.commit()
    return _fijo_salida(sesion, f, _registrados(sesion, hoy_bogota().strftime("%Y-%m")))


@router.put("/gastos-fijos/{fijo_id}")
def editar_fijo(fijo_id: int, datos: GastoFijoEntrada, sesion: SesionDB) -> GastoFijoSalida:
    f = _fijo(sesion, fijo_id)
    _llenar_fijo(sesion, f, datos)
    sesion.commit()
    return _fijo_salida(sesion, f, _registrados(sesion, hoy_bogota().strftime("%Y-%m")))


@router.delete("/gastos-fijos/{fijo_id}", status_code=204)
def archivar_fijo(fijo_id: int, sesion: SesionDB) -> None:
    _fijo(sesion, fijo_id).activo = False
    sesion.commit()


@router.get("/cuentas/resumen")
def resumen(sesion: SesionDB, mes: str = "") -> ResumenMes:
    mes = mes or hoy_bogota().strftime("%Y-%m")
    inicio, fin = mes_utc(mes)
    filas = sesion.execute(
        select(Transaccion, Categoria)
        .outerjoin(Categoria, Transaccion.categoria_id == Categoria.id)
        .where(Transaccion.fecha >= inicio, Transaccion.fecha < fin)
    ).all()
    entro = sum(t.monto for t, _ in filas if t.tipo == "ingreso")
    retiros = sum(
        t.monto for t, c in filas if t.tipo == "egreso" and c is not None and c.tipo == "retiro"
    )
    por_categoria: dict[str, int] = {}
    for t, c in filas:
        if t.tipo == "egreso" and (c is None or c.tipo != "retiro"):
            nombre = c.nombre if c else "Otros gastos"
            por_categoria[nombre] = por_categoria.get(nombre, 0) + t.monto
    salio = sum(por_categoria.values())
    al_cierre = saldos(sesion, fin)
    cuentas = sesion.scalars(select(Cuenta).order_by(Cuenta.id))
    return ResumenMes(
        mes=mes,
        entro=entro,
        salio=salio,
        ganancia=entro - salio,
        retiros=retiros,
        por_categoria=[
            MontoCategoria(categoria=n, monto=m)
            for n, m in sorted(por_categoria.items(), key=lambda x: -x[1])
        ],
        saldos_al_cierre=[
            SaldoCuenta(cuenta=c.nombre, saldo=al_cierre[c.id])
            for c in cuentas
            if c.activa or al_cierre[c.id] != 0
        ],
    )
