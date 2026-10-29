"""Insumos: unidad propia, conversión de compra, precio vigente con historial."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.db import SesionDB
from app.inventario.esquemas import (
    Conteo,
    EntradaInsumo,
    InsumoEntrada,
    InsumoSalida,
    MermaInsumo,
    MovimientoSalida,
    PrecioSalida,
)
from app.inventario.existencias import (
    ErrorInventario,
    contar,
    estado_stock,
    existencia,
    existencias,
    registrar_movimiento,
)
from app.inventario.modelos import Insumo, MovimientoInventario, PrecioInsumo
from app.inventario.productos import GRAVEDAD, sin_tildes, ultimos_movimientos

router = APIRouter(prefix="/api/inventario/insumos", dependencies=[Depends(usuario_actual)])

CENTAVO = Decimal("0.01")


def precio_vigente(sesion: Session, insumo_id: int) -> Decimal | None:
    return sesion.scalar(
        select(PrecioInsumo.precio_unitario)
        .where(PrecioInsumo.insumo_id == insumo_id)
        .order_by(PrecioInsumo.desde.desc(), PrecioInsumo.id.desc())
        .limit(1)
    )


def _nuevo_precio(sesion: Session, insumo_id: int, precio: Decimal, origen: str) -> None:
    precio = precio.quantize(CENTAVO)
    if precio_vigente(sesion, insumo_id) != precio:
        sesion.add(PrecioInsumo(insumo_id=insumo_id, precio_unitario=precio, origen=origen))
        sesion.flush()


def _insumo(sesion: Session, insumo_id: int) -> Insumo:
    insumo = sesion.get(Insumo, insumo_id)
    if insumo is None:
        raise HTTPException(404, "Ese insumo no existe.")
    return insumo


def _salida(sesion: Session, i: Insumo, cantidad: Decimal | None = None) -> InsumoSalida:
    if cantidad is None:
        cantidad = existencia(sesion, insumo_id=i.id)
    return InsumoSalida(
        id=i.id,
        nombre=i.nombre,
        tipo=i.tipo,
        unidad=i.unidad,
        unidad_compra=i.unidad_compra,
        factor_compra=i.factor_compra,
        stock_minimo=i.stock_minimo,
        proveedor=i.proveedor,
        activo=i.activo,
        precio_unitario=precio_vigente(sesion, i.id),
        existencia=cantidad,
        estado=estado_stock(cantidad, i.stock_minimo) if i.activo else "ok",
    )


def _revisar(sesion: Session, datos: InsumoEntrada, propio: int | None) -> None:
    if (datos.unidad_compra is None) != (datos.factor_compra is None):
        raise ErrorInventario("Escribe la unidad de compra y cuánto trae.")
    # SQLite no pasa a minúsculas las letras con tilde: se compara en Python.
    nombre = datos.nombre.casefold()
    for otro_id, otro, activo in sesion.execute(select(Insumo.id, Insumo.nombre, Insumo.activo)):
        if otro_id != propio and otro.casefold() == nombre:
            if not activo:
                raise HTTPException(
                    409,
                    f"Ya existe el insumo {datos.nombre}, archivado. "
                    "Búscalo en Archivados y vuelve a usarlo.",
                )
            raise HTTPException(409, f"Ya existe el insumo {datos.nombre}.")


def _aplicar(insumo: Insumo, datos: InsumoEntrada) -> None:
    for campo, valor in datos.model_dump(exclude={"precio_unitario"}).items():
        setattr(insumo, campo, valor)


@router.get("")
def listar_insumos(
    sesion: SesionDB, buscar: str = "", tipo: str = "", archivados: bool = False
) -> list[InsumoSalida]:
    consulta = select(Insumo).where(Insumo.activo.is_(not archivados))
    if tipo:
        consulta = consulta.where(Insumo.tipo == tipo)
    insumos = list(sesion.scalars(consulta).all())
    palabras = sin_tildes(buscar).split()
    if palabras:
        insumos = [
            i
            for i in insumos
            if all(p in sin_tildes(f"{i.nombre} {i.proveedor or ''}") for p in palabras)
        ]
    cantidades = existencias(sesion, insumos=[i.id for i in insumos])
    resultado = [_salida(sesion, i, cantidades[i.id]) for i in insumos]
    resultado.sort(key=lambda r: (GRAVEDAD[r.estado], sin_tildes(r.nombre)))
    return resultado


@router.post("", status_code=201)
def crear_insumo(datos: InsumoEntrada, sesion: SesionDB) -> InsumoSalida:
    _revisar(sesion, datos, None)
    insumo = Insumo()
    _aplicar(insumo, datos)
    sesion.add(insumo)
    sesion.flush()
    if datos.precio_unitario is not None:
        _nuevo_precio(sesion, insumo.id, datos.precio_unitario, "edicion")
    sesion.commit()
    return _salida(sesion, insumo)


@router.get("/{insumo_id}")
def ver_insumo(insumo_id: int, sesion: SesionDB) -> InsumoSalida:
    return _salida(sesion, _insumo(sesion, insumo_id))


@router.put("/{insumo_id}")
def editar_insumo(insumo_id: int, datos: InsumoEntrada, sesion: SesionDB) -> InsumoSalida:
    insumo = _insumo(sesion, insumo_id)
    _revisar(sesion, datos, insumo.id)
    _aplicar(insumo, datos)
    if datos.precio_unitario is not None:
        _nuevo_precio(sesion, insumo.id, datos.precio_unitario, "edicion")
    sesion.commit()
    return _salida(sesion, insumo)


@router.delete("/{insumo_id}", status_code=204)
def borrar_insumo(insumo_id: int, sesion: SesionDB) -> Response:
    insumo = _insumo(sesion, insumo_id)
    if sesion.scalar(select(exists().where(MovimientoInventario.insumo_id == insumo.id))):
        insumo.activo = False
    else:
        sesion.delete(insumo)
    sesion.commit()
    return Response(status_code=204)


@router.post("/{insumo_id}/restaurar")
def restaurar_insumo(insumo_id: int, sesion: SesionDB) -> InsumoSalida:
    insumo = _insumo(sesion, insumo_id)
    insumo.activo = True
    sesion.commit()
    return _salida(sesion, insumo)


@router.get("/{insumo_id}/precios")
def precios_insumo(insumo_id: int, sesion: SesionDB) -> list[PrecioSalida]:
    insumo = _insumo(sesion, insumo_id)
    precios = sesion.scalars(
        select(PrecioInsumo)
        .where(PrecioInsumo.insumo_id == insumo.id)
        .order_by(PrecioInsumo.desde.desc(), PrecioInsumo.id.desc())
    )
    return [PrecioSalida.model_validate(p, from_attributes=True) for p in precios]


@router.post("/{insumo_id}/entradas", status_code=201)
def entrada_insumo(insumo_id: int, datos: EntradaInsumo, sesion: SesionDB) -> InsumoSalida:
    insumo = _insumo(sesion, insumo_id)
    cantidad, precio = datos.cantidad, datos.precio_unitario
    if datos.en_unidad_compra:
        if not insumo.factor_compra:
            raise ErrorInventario("Este insumo no tiene unidad de compra.")
        cantidad = cantidad * insumo.factor_compra
        if precio is not None:
            precio = precio / insumo.factor_compra
    if precio is not None:
        precio = precio.quantize(CENTAVO)
    registrar_movimiento(
        sesion,
        tipo="compra",
        cantidad=cantidad,
        insumo_id=insumo.id,
        costo_unitario=precio,
        nota=datos.nota,
    )
    if precio is not None:
        _nuevo_precio(sesion, insumo.id, precio, "compra")
    sesion.commit()
    return _salida(sesion, insumo)


@router.post("/{insumo_id}/movimientos", status_code=201)
def merma_insumo(insumo_id: int, datos: MermaInsumo, sesion: SesionDB) -> InsumoSalida:
    insumo = _insumo(sesion, insumo_id)
    registrar_movimiento(
        sesion,
        tipo="merma",
        cantidad=-datos.cantidad,
        insumo_id=insumo.id,
        nota=datos.nota,
        unidad=insumo.unidad,
    )
    sesion.commit()
    return _salida(sesion, insumo)


@router.post("/{insumo_id}/conteo")
def contar_insumo(insumo_id: int, datos: Conteo, sesion: SesionDB) -> InsumoSalida:
    insumo = _insumo(sesion, insumo_id)
    contar(sesion, cantidad_contada=datos.cantidad_contada, insumo_id=insumo.id, nota=datos.nota)
    sesion.commit()
    return _salida(sesion, insumo)


@router.get("/{insumo_id}/movimientos")
def movimientos_insumo(insumo_id: int, sesion: SesionDB) -> list[MovimientoSalida]:
    insumo = _insumo(sesion, insumo_id)
    return ultimos_movimientos(sesion, MovimientoInventario.insumo_id == insumo.id)
