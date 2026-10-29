"""Venta rápida: un pedido inmediato que descuenta la vitrina y suma el ingreso a una cuenta."""

from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.db import SesionDB
from app.hora import BOGOTA, a_utc, hoy_bogota, limites_del_dia
from app.inventario.existencias import ErrorInventario, existencias, registrar_movimiento
from app.inventario.modelos import Modelo, Variante
from app.inventario.productos import sin_tildes
from app.ventas.esquemas import (
    CatalogoItem,
    CuentaSalida,
    DiaVentas,
    ItemSalida,
    VentaEntrada,
    VentaSalida,
)
from app.ventas.modelos import (
    Categoria,
    Cliente,
    Cuenta,
    Pago,
    Pedido,
    PedidoItem,
    Transaccion,
    ahora_utc,
)

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])

# Mientras no haya recetas (fase 2) el costo es solo la mano de obra.
VALOR_HORA = Decimal(10_000)
ELIGE_CUENTA = "Elige la cuenta donde entró el dinero."


def numero(pedido_id: int) -> str:
    return f"{pedido_id:04d}"


def venta_salida(sesion: Session, pedido: Pedido) -> VentaSalida:
    filas = sesion.execute(
        select(PedidoItem, Variante, Modelo)
        .join(Variante, PedidoItem.variante_id == Variante.id)
        .join(Modelo, Variante.modelo_id == Modelo.id)
        .where(PedidoItem.pedido_id == pedido.id)
        .order_by(PedidoItem.id)
    ).all()
    items = [
        ItemSalida(
            variante_id=v.id,
            modelo=m.nombre,
            color=v.color,
            cantidad=i.cantidad,
            precio_unitario=i.precio_unitario,
            subtotal=i.cantidad * i.precio_unitario,
        )
        for i, v, m in filas
    ]
    cuenta = sesion.scalar(
        select(Cuenta).join(Pago, Pago.cuenta_id == Cuenta.id).where(Pago.pedido_id == pedido.id)
    )
    return VentaSalida(
        id=pedido.id,
        numero=numero(pedido.id),
        fecha=pedido.fecha,
        canal=pedido.canal,
        estado=pedido.estado,
        cliente=sesion.get(Cliente, pedido.cliente_id).nombre,
        cuenta=CuentaSalida(id=cuenta.id, nombre=cuenta.nombre) if cuenta else None,
        items=items,
        subtotal=sum(i.subtotal for i in items),
        descuento=pedido.descuento,
        total=pedido.total,
        comprobante=(
            f"/api/pedidos/{pedido.id}/comprobante.pdf?v={pedido.actualizado:%Y%m%d%H%M%S%f}"
        ),
    )


def _fecha(dia) -> datetime:
    hoy = hoy_bogota()
    if dia is not None and dia > hoy:
        raise ErrorInventario("La fecha no puede ser futura.")
    if dia is None or dia == hoy:
        return ahora_utc()
    # Venta anotada en una feria y registrada después: se ubica al mediodía de ese día.
    return a_utc(datetime.combine(dia, time(12), BOGOTA))


def registrar_venta(sesion: Session, datos: VentaEntrada) -> Pedido:
    cuenta = sesion.get(Cuenta, datos.cuenta_id)
    if cuenta is None or not cuenta.activa:
        raise ErrorInventario(ELIGE_CUENTA)
    fecha = _fecha(datos.fecha)
    cantidades: dict[int, int] = {}
    for i in datos.items:
        cantidades[i.variante_id] = cantidades.get(i.variante_id, 0) + i.cantidad
    lineas = []
    for variante_id, cantidad in cantidades.items():
        variante = sesion.get(Variante, variante_id)
        if variante is None:
            raise HTTPException(404, "Ese producto no existe.")
        modelo = sesion.get(Modelo, variante.modelo_id)
        if not (variante.activo and modelo.activo):
            raise ErrorInventario(f"{modelo.nombre} {variante.color} está archivado.")
        lineas.append((variante, modelo, cantidad))
    subtotal = sum(m.precio_venta * n for _, m, n in lineas)
    if datos.descuento > subtotal:
        raise ErrorInventario("El descuento no puede ser mayor que el subtotal.")

    mostrador = sesion.scalar(select(Cliente.id).where(Cliente.es_mostrador).limit(1))
    pedido = Pedido(
        fecha=fecha,
        canal=datos.canal,
        tipo="inmediata",
        estado="entregado",
        cliente_id=mostrador,
        descuento=datos.descuento,
        total=subtotal - datos.descuento,
        nota=datos.nota,
    )
    sesion.add(pedido)
    sesion.flush()
    for variante, modelo, cantidad in lineas:
        sesion.add(
            PedidoItem(
                pedido_id=pedido.id,
                variante_id=variante.id,
                cantidad=cantidad,
                precio_unitario=modelo.precio_venta,
                costo_unitario=int((modelo.horas_tejido * VALOR_HORA).quantize(Decimal(1))),
            )
        )
        registrar_movimiento(
            sesion,
            tipo="venta",
            cantidad=Decimal(-cantidad),
            variante_id=variante.id,
            pedido_id=pedido.id,
            unidad=f"de {modelo.nombre} {variante.color}",
        )
    if pedido.total > 0:
        pago = Pago(pedido_id=pedido.id, cuenta_id=cuenta.id, monto=pedido.total)
        sesion.add(pago)
        sesion.flush()
        ventas = sesion.scalar(select(Categoria.id).where(Categoria.nombre == "Ventas"))
        sesion.add(
            Transaccion(
                tipo="ingreso",
                monto=pedido.total,
                descripcion=f"Venta N.º {numero(pedido.id)}",
                cuenta_id=cuenta.id,
                categoria_id=ventas,
                pago_id=pago.id,
            )
        )
    sesion.flush()
    return pedido


@router.get("/cuentas")
def listar_cuentas(sesion: SesionDB) -> list[CuentaSalida]:
    cuentas = sesion.scalars(select(Cuenta).where(Cuenta.activa).order_by(Cuenta.id))
    return [CuentaSalida(id=c.id, nombre=c.nombre) for c in cuentas]


@router.get("/ventas/catalogo")
def catalogo(sesion: SesionDB) -> list[CatalogoItem]:
    filas = sesion.execute(
        select(Variante, Modelo)
        .join(Modelo, Variante.modelo_id == Modelo.id)
        .where(Variante.activo, Modelo.activo)
    ).all()
    cantidades = existencias(sesion, variantes=[v.id for v, _ in filas])
    resultado = [
        CatalogoItem(
            variante_id=v.id,
            modelo_id=m.id,
            nombre=m.nombre,
            color=v.color,
            sku=v.sku,
            foto=v.foto or m.foto,
            categoria=m.categoria,
            precio=m.precio_venta,
            existencia=int(cantidades[v.id]),
        )
        for v, m in filas
        if cantidades[v.id] > 0
    ]
    resultado.sort(key=lambda i: (sin_tildes(i.nombre), sin_tildes(i.color)))
    return resultado


@router.post("/ventas", status_code=201)
def crear_venta(datos: VentaEntrada, sesion: SesionDB) -> VentaSalida:
    pedido = registrar_venta(sesion, datos)
    sesion.commit()
    return venta_salida(sesion, pedido)


def _venta(sesion: Session, venta_id: int) -> Pedido:
    pedido = sesion.get(Pedido, venta_id)
    if pedido is None or pedido.tipo != "inmediata":
        raise HTTPException(404, "Esa venta no existe.")
    return pedido


def anular_venta(sesion: Session, pedido: Pedido) -> None:
    """Corrige una venta mal registrada: no es una devolución de dinero, así que el ingreso se quita."""
    if pedido.estado == "cancelado":
        raise HTTPException(409, "Esta venta ya está anulada.")
    pedido.estado = "cancelado"
    pedido.actualizado = ahora_utc()
    for item in sesion.scalars(select(PedidoItem).where(PedidoItem.pedido_id == pedido.id)):
        registrar_movimiento(
            sesion,
            tipo="devolucion",
            cantidad=Decimal(item.cantidad),
            variante_id=item.variante_id,
            pedido_id=pedido.id,
            nota=f"Venta N.º {numero(pedido.id)} anulada",
        )
    pagos = select(Pago.id).where(Pago.pedido_id == pedido.id)
    sesion.execute(delete(Transaccion).where(Transaccion.pago_id.in_(pagos)))
    sesion.execute(delete(Pago).where(Pago.pedido_id == pedido.id))
    sesion.flush()


@router.get("/ventas")
def ventas_del_dia(sesion: SesionDB, dia: date | None = None) -> DiaVentas:
    dia = dia or hoy_bogota()
    inicio, fin = limites_del_dia(dia)
    pedidos = sesion.scalars(
        select(Pedido)
        .where(Pedido.tipo == "inmediata", Pedido.fecha >= inicio, Pedido.fecha < fin)
        .order_by(Pedido.fecha.desc(), Pedido.id.desc())
    ).all()
    validas = [p for p in pedidos if p.estado != "cancelado"]
    return DiaVentas(
        dia=dia,
        ventas=[venta_salida(sesion, p) for p in pedidos],
        total=sum(p.total for p in validas),
        cantidad=len(validas),
    )


@router.get("/ventas/{venta_id}")
def ver_venta(venta_id: int, sesion: SesionDB) -> VentaSalida:
    return venta_salida(sesion, _venta(sesion, venta_id))


@router.post("/ventas/{venta_id}/anular")
def anular(venta_id: int, sesion: SesionDB) -> VentaSalida:
    pedido = _venta(sesion, venta_id)
    anular_venta(sesion, pedido)
    sesion.commit()
    return venta_salida(sesion, pedido)
