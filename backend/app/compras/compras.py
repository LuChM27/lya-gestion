"""Compras de insumos: entran al inventario y, si se pagaron, salen de una cuenta.

El pago puede registrarse después. Una compra mal hecha se anula: los insumos salen,
y el egreso y los precios que fijó se borran.
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.compras.esquemas import CompraEntrada, CompraSalida, ItemCompraSalida, PagoCompra
from app.compras.modelos import Compra
from app.db import SesionDB
from app.hora import fecha_de_registro
from app.inventario.existencias import ErrorInventario, registrar_movimiento
from app.inventario.insumos import CENTAVO, _nuevo_precio
from app.inventario.modelos import Insumo, MovimientoInventario, PrecioInsumo
from app.inventario.productos import sin_tildes
from app.ventas.esquemas import CuentaSalida
from app.ventas.modelos import Categoria, Cuenta, Transaccion, ahora_utc

router = APIRouter(prefix="/api/compras", dependencies=[Depends(usuario_actual)])

ANULADA = "Esta compra está anulada."


def numero(compra_id: int) -> str:
    return f"{compra_id:04d}"


def _cuenta_activa(sesion: Session, cuenta_id: int) -> Cuenta:
    cuenta = sesion.get(Cuenta, cuenta_id)
    if cuenta is None or not cuenta.activa:
        raise HTTPException(422, "Elige una cuenta.")
    return cuenta


def _egreso(sesion: Session, compra: Compra, cuenta: Cuenta, fecha) -> Transaccion:
    insumos = sesion.scalar(select(Categoria.id).where(Categoria.nombre == "Insumos"))
    descripcion = f"Compra N.º {numero(compra.id)}"
    if compra.proveedor:
        descripcion += f" · {compra.proveedor}"
    t = Transaccion(
        fecha=fecha,
        tipo="egreso",
        monto=compra.total,
        descripcion=descripcion,
        cuenta_id=cuenta.id,
        categoria_id=insumos,
        compra_id=compra.id,
    )
    sesion.add(t)
    return t


def _salidas(sesion: Session, compras: list[Compra]) -> list[CompraSalida]:
    """Arma varias compras con tres consultas en total, no tres por compra."""
    ids = [c.id for c in compras]
    if not ids:
        return []
    items: dict[int, list[ItemCompraSalida]] = {i: [] for i in ids}
    filas = sesion.execute(
        select(MovimientoInventario, Insumo)
        .join(Insumo, MovimientoInventario.insumo_id == Insumo.id)
        .where(MovimientoInventario.compra_id.in_(ids), MovimientoInventario.tipo == "compra")
        .order_by(MovimientoInventario.id)
    ).all()
    for m, i in filas:
        items[m.compra_id].append(
            ItemCompraSalida(
                insumo_id=i.id,
                insumo=i.nombre,
                cantidad=m.cantidad,
                unidad=i.unidad,
                precio_unitario=m.costo_unitario,
                subtotal=int((m.cantidad * m.costo_unitario).quantize(Decimal(1))),
            )
        )
    cuenta_ids = {c.cuenta_id for c in compras if c.cuenta_id}
    cuentas = (
        {c.id: c for c in sesion.scalars(select(Cuenta).where(Cuenta.id.in_(cuenta_ids)))}
        if cuenta_ids
        else {}
    )
    pagos = dict(
        sesion.execute(
            select(Transaccion.compra_id, Transaccion.fecha).where(Transaccion.compra_id.in_(ids))
        ).all()
    )
    salidas = []
    for compra in compras:
        cuenta = cuentas.get(compra.cuenta_id) if compra.cuenta_id else None
        salidas.append(
            CompraSalida(
                id=compra.id,
                numero=numero(compra.id),
                fecha=compra.fecha,
                proveedor=compra.proveedor,
                total=compra.total,
                estado=compra.estado,
                nota=compra.nota,
                cuenta=CuentaSalida(id=cuenta.id, nombre=cuenta.nombre) if cuenta else None,
                pagada_el=pagos.get(compra.id),
                items=items[compra.id],
            )
        )
    return salidas


def salida(sesion: Session, compra: Compra) -> CompraSalida:
    return _salidas(sesion, [compra])[0]


def _compra(sesion: Session, compra_id: int) -> Compra:
    compra = sesion.get(Compra, compra_id)
    if compra is None:
        raise HTTPException(404, "Esa compra no existe.")
    return compra


@router.post("", status_code=201)
def crear(datos: CompraEntrada, sesion: SesionDB) -> CompraSalida:
    fecha = fecha_de_registro(datos.fecha)
    cuenta = _cuenta_activa(sesion, datos.cuenta_id) if datos.cuenta_id is not None else None
    lineas = []
    for item in datos.items:
        insumo = sesion.get(Insumo, item.insumo_id)
        if insumo is None:
            raise HTTPException(404, "Ese insumo no existe.")
        if not insumo.activo:
            raise ErrorInventario(f"{insumo.nombre} está archivado.")
        cantidad, precio = item.cantidad, item.precio_unitario
        if item.en_unidad_compra:
            if not insumo.factor_compra:
                raise ErrorInventario("Este insumo no tiene unidad de compra.")
            cantidad = cantidad * insumo.factor_compra
            precio = precio / insumo.factor_compra
        lineas.append((insumo, cantidad, precio.quantize(CENTAVO)))
    total = sum(int((c * p).quantize(Decimal(1))) for _, c, p in lineas)
    compra = Compra(
        fecha=fecha,
        proveedor=datos.proveedor or None,
        total=total,
        cuenta_id=cuenta.id if cuenta else None,
        estado="activa",
        nota=datos.nota,
        actualizado=ahora_utc(),
    )
    sesion.add(compra)
    sesion.flush()
    for insumo, cantidad, precio in lineas:
        registrar_movimiento(
            sesion,
            tipo="compra",
            cantidad=cantidad,
            insumo_id=insumo.id,
            costo_unitario=precio,
            fecha=fecha,
            compra_id=compra.id,
            nota=f"Compra N.º {numero(compra.id)}",
        )
        _nuevo_precio(sesion, insumo.id, precio, "compra", compra_id=compra.id)
    if cuenta is not None:
        _egreso(sesion, compra, cuenta, fecha)
    sesion.commit()
    return salida(sesion, compra)


@router.get("")
def listar(sesion: SesionDB, sin_pagar: bool = False) -> list[CompraSalida]:
    consulta = select(Compra)
    if sin_pagar:
        consulta = consulta.where(Compra.cuenta_id.is_(None), Compra.estado == "activa")
    compras = sesion.scalars(consulta.order_by(Compra.fecha.desc(), Compra.id.desc())).all()
    return _salidas(sesion, list(compras))


@router.get("/proveedores")
def proveedores(sesion: SesionDB) -> list[str]:
    nombres = sesion.scalars(
        select(Compra.proveedor).where(Compra.proveedor.is_not(None)).distinct()
    )
    unicos: dict[str, str] = {}
    for n in nombres:
        unicos.setdefault(sin_tildes(n), n)
    return sorted(unicos.values(), key=sin_tildes)


@router.get("/{compra_id}")
def ver(compra_id: int, sesion: SesionDB) -> CompraSalida:
    return salida(sesion, _compra(sesion, compra_id))


@router.post("/{compra_id}/pago")
def pagar(compra_id: int, datos: PagoCompra, sesion: SesionDB) -> CompraSalida:
    compra = _compra(sesion, compra_id)
    cuenta = _cuenta_activa(sesion, datos.cuenta_id)
    fecha = fecha_de_registro(datos.fecha)
    if datos.fecha is not None and fecha.date() < compra.fecha.date():
        raise HTTPException(422, "El pago no puede ser de antes de la compra.")
    # Condicional: si otro equipo (o un doble toque) pagó o anuló primero, no cambia nada.
    cambio = sesion.execute(
        update(Compra)
        .where(Compra.id == compra.id, Compra.cuenta_id.is_(None), Compra.estado == "activa")
        .values(cuenta_id=cuenta.id, actualizado=ahora_utc())
    )
    if cambio.rowcount == 0:
        sesion.rollback()
        compra = _compra(sesion, compra_id)
        raise HTTPException(
            409, ANULADA if compra.estado == "anulada" else "Esta compra ya está pagada."
        )
    sesion.refresh(compra)
    _egreso(sesion, compra, cuenta, fecha)
    sesion.commit()
    return salida(sesion, compra)


@router.post("/{compra_id}/anular")
def anular(compra_id: int, sesion: SesionDB) -> CompraSalida:
    compra = _compra(sesion, compra_id)
    cambio = sesion.execute(
        update(Compra)
        .where(Compra.id == compra.id, Compra.estado == "activa")
        .values(estado="anulada", actualizado=ahora_utc())
    )
    if cambio.rowcount == 0:
        raise HTTPException(409, ANULADA)
    sesion.refresh(compra)
    entradas = sesion.scalars(
        select(MovimientoInventario).where(
            MovimientoInventario.compra_id == compra.id, MovimientoInventario.tipo == "compra"
        )
    ).all()
    for m in entradas:
        # Lo comprado pudo gastarse ya: el inventario puede quedar en negativo, como en producción.
        registrar_movimiento(
            sesion,
            tipo="anulacion",
            cantidad=-m.cantidad,
            insumo_id=m.insumo_id,
            permitir_negativo=True,
            compra_id=compra.id,
            nota=f"Compra N.º {numero(compra.id)} anulada",
        )
    sesion.execute(delete(Transaccion).where(Transaccion.compra_id == compra.id))
    sesion.execute(delete(PrecioInsumo).where(PrecioInsumo.compra_id == compra.id))
    sesion.commit()
    return salida(sesion, compra)
