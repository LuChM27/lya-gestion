"""Productos terminados: modelos y sus variantes de color o piezas únicas."""

import unicodedata
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, exists, select, true, update
from sqlalchemy.orm import Session

from app.auth.dependencias import usuario_actual
from app.db import SesionDB
from app.inventario.esquemas import (
    Conteo,
    ModeloDetalle,
    ModeloEntrada,
    ModeloResumen,
    MovimientoSalida,
    MovimientoVariante,
    VarianteEntrada,
    VarianteSalida,
)
from app.inventario.existencias import (
    ErrorInventario,
    contar,
    estado_stock,
    existencia,
    existencias,
    registrar_movimiento,
)
from app.inventario.modelos import Modelo, MovimientoInventario, Variante

router = APIRouter(prefix="/api/inventario", dependencies=[Depends(usuario_actual)])

GRAVEDAD = {"bajo_minimo": 0, "por_agotarse": 1, "ok": 2}
PIEZA_UNICA = "Una pieza única solo puede tener 1 unidad."


def sin_tildes(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFKD", texto.casefold())
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


def peor_estado(estados: list[str]) -> str:
    return min(estados, key=GRAVEDAD.__getitem__, default="ok")


def _modelo(sesion: Session, modelo_id: int) -> Modelo:
    modelo = sesion.get(Modelo, modelo_id)
    if modelo is None:
        raise HTTPException(404, "Ese modelo no existe.")
    return modelo


def _variante(sesion: Session, variante_id: int) -> Variante:
    variante = sesion.get(Variante, variante_id)
    if variante is None:
        raise HTTPException(404, "Esa variante no existe.")
    return variante


def _salida_variante(v: Variante, cantidad: Decimal) -> VarianteSalida:
    return VarianteSalida(
        id=v.id,
        color=v.color,
        sku=v.sku,
        stock_minimo=v.stock_minimo,
        foto=v.foto,
        pieza_unica=v.pieza_unica,
        activo=v.activo,
        existencia=cantidad,
        estado=estado_stock(cantidad, v.stock_minimo) if v.activo else "ok",
    )


def _variante_con_existencia(sesion: Session, v: Variante) -> VarianteSalida:
    return _salida_variante(v, existencia(sesion, variante_id=v.id))


def _resumenes(sesion: Session, modelos: list[Modelo]) -> dict[int, list[VarianteSalida]]:
    variantes = sesion.scalars(
        select(Variante)
        .where(Variante.modelo_id.in_([m.id for m in modelos]))
        .order_by(Variante.color)
    ).all()
    cantidades = existencias(sesion, variantes=[v.id for v in variantes])
    por_modelo: dict[int, list[VarianteSalida]] = {m.id: [] for m in modelos}
    for v in variantes:
        por_modelo[v.modelo_id].append(_salida_variante(v, cantidades[v.id]))
    return por_modelo


def _detalle(modelo: Modelo, variantes: list[VarianteSalida]) -> ModeloDetalle:
    activas = [v for v in variantes if v.activo]
    return ModeloDetalle(
        id=modelo.id,
        nombre=modelo.nombre,
        categoria=modelo.categoria,
        precio_venta=modelo.precio_venta,
        foto=modelo.foto,
        activo=modelo.activo,
        horas_tejido=modelo.horas_tejido,
        unidades=sum((v.existencia for v in activas), Decimal(0)),
        variantes=variantes,
        estado=peor_estado([v.estado for v in activas]),
    )


def _detalle_de(sesion: Session, modelo: Modelo) -> ModeloDetalle:
    return _detalle(modelo, _resumenes(sesion, [modelo])[modelo.id])


def _tiene_movimientos(sesion: Session, *condiciones) -> bool:
    return bool(sesion.scalar(select(exists().where(*condiciones))))


def _revisar_variante(sesion: Session, modelo_id: int, datos: VarianteEntrada, propia: int | None):
    otra = Variante.id != propia if propia is not None else true()
    repetida = sesion.scalar(
        select(exists().where(Variante.modelo_id == modelo_id, Variante.color == datos.color, otra))
    )
    if repetida:
        raise HTTPException(409, f"Ya existe la variante {datos.color} en este modelo.")
    if datos.sku and sesion.scalar(select(exists().where(Variante.sku == datos.sku, otra))):
        raise HTTPException(409, f"El código {datos.sku} ya está en uso.")


def _aplicar_variante(v: Variante, datos: VarianteEntrada) -> None:
    v.color = datos.color
    v.foto = datos.foto
    v.pieza_unica = datos.pieza_unica
    v.stock_minimo = Decimal(0) if datos.pieza_unica else datos.stock_minimo
    if datos.sku:
        v.sku = datos.sku


@router.get("/modelos")
def listar_modelos(
    sesion: SesionDB, buscar: str = "", categoria: str = "", archivados: bool = False
) -> list[ModeloResumen]:
    consulta = select(Modelo).where(Modelo.activo.is_(not archivados))
    if categoria:
        consulta = consulta.where(Modelo.categoria == categoria)
    modelos = sesion.scalars(consulta).all()
    variantes = _resumenes(sesion, list(modelos))
    palabras = sin_tildes(buscar).split()
    resultado = []
    for m in modelos:
        detalle = _detalle(m, variantes[m.id])
        if palabras:
            pajar = sin_tildes(
                " ".join([m.nombre, *(f"{v.color} {v.sku}" for v in variantes[m.id])])
            )
            if not all(p in pajar for p in palabras):
                continue
        resultado.append(
            ModeloResumen(
                **detalle.model_dump(exclude={"variantes", "horas_tejido"}),
                variantes=sum(1 for v in detalle.variantes if v.activo),
            )
        )
    resultado.sort(key=lambda r: (GRAVEDAD[r.estado], sin_tildes(r.nombre)))
    return resultado


@router.post("/modelos", status_code=201)
def crear_modelo(datos: ModeloEntrada, sesion: SesionDB) -> ModeloDetalle:
    modelo = Modelo(**datos.model_dump())
    sesion.add(modelo)
    sesion.commit()
    return _detalle_de(sesion, modelo)


@router.get("/modelos/{modelo_id}")
def ver_modelo(modelo_id: int, sesion: SesionDB) -> ModeloDetalle:
    return _detalle_de(sesion, _modelo(sesion, modelo_id))


@router.put("/modelos/{modelo_id}")
def editar_modelo(modelo_id: int, datos: ModeloEntrada, sesion: SesionDB) -> ModeloDetalle:
    modelo = _modelo(sesion, modelo_id)
    for campo, valor in datos.model_dump().items():
        setattr(modelo, campo, valor)
    sesion.commit()
    return _detalle_de(sesion, modelo)


@router.delete("/modelos/{modelo_id}", status_code=204)
def borrar_modelo(modelo_id: int, sesion: SesionDB) -> Response:
    modelo = _modelo(sesion, modelo_id)
    ids = select(Variante.id).where(Variante.modelo_id == modelo.id)
    if _tiene_movimientos(sesion, MovimientoInventario.variante_id.in_(ids)):
        modelo.activo = False
        sesion.execute(update(Variante).where(Variante.modelo_id == modelo.id).values(activo=False))
    else:
        sesion.execute(delete(Variante).where(Variante.modelo_id == modelo.id))
        sesion.delete(modelo)
    sesion.commit()
    return Response(status_code=204)


@router.post("/modelos/{modelo_id}/variantes", status_code=201)
def crear_variante(modelo_id: int, datos: VarianteEntrada, sesion: SesionDB) -> VarianteSalida:
    modelo = _modelo(sesion, modelo_id)
    _revisar_variante(sesion, modelo.id, datos, None)
    variante = Variante(modelo_id=modelo.id, sku=f"pendiente-{modelo.id}-{datos.color}"[:30])
    _aplicar_variante(variante, datos)
    sesion.add(variante)
    sesion.flush()
    if not datos.sku:
        sku, n = f"LA-{variante.id:04d}", 1
        while sesion.scalar(select(exists().where(Variante.sku == sku))):
            n += 1
            sku = f"LA-{variante.id:04d}-{n}"
        variante.sku = sku
    sesion.commit()
    return _salida_variante(variante, Decimal(0))


@router.put("/variantes/{variante_id}")
def editar_variante(variante_id: int, datos: VarianteEntrada, sesion: SesionDB) -> VarianteSalida:
    variante = _variante(sesion, variante_id)
    _revisar_variante(sesion, variante.modelo_id, datos, variante.id)
    if datos.pieza_unica and existencia(sesion, variante_id=variante.id) > 1:
        raise ErrorInventario(PIEZA_UNICA)
    _aplicar_variante(variante, datos)
    sesion.commit()
    return _variante_con_existencia(sesion, variante)


@router.delete("/variantes/{variante_id}", status_code=204)
def borrar_variante(variante_id: int, sesion: SesionDB) -> Response:
    variante = _variante(sesion, variante_id)
    if _tiene_movimientos(sesion, MovimientoInventario.variante_id == variante.id):
        variante.activo = False
    else:
        sesion.delete(variante)
    sesion.commit()
    return Response(status_code=204)


@router.post("/variantes/{variante_id}/movimientos", status_code=201)
def mover_variante(variante_id: int, datos: MovimientoVariante, sesion: SesionDB) -> VarianteSalida:
    variante = _variante(sesion, variante_id)
    signo = -1 if datos.tipo == "merma" else 1
    if (
        variante.pieza_unica
        and signo > 0
        and existencia(sesion, variante_id=variante.id) + datos.cantidad > 1
    ):
        raise ErrorInventario(PIEZA_UNICA)
    registrar_movimiento(
        sesion,
        tipo=datos.tipo,
        cantidad=signo * datos.cantidad,
        variante_id=variante.id,
        nota=datos.nota,
    )
    sesion.commit()
    return _variante_con_existencia(sesion, variante)


@router.post("/variantes/{variante_id}/conteo")
def contar_variante(variante_id: int, datos: Conteo, sesion: SesionDB) -> VarianteSalida:
    variante = _variante(sesion, variante_id)
    if variante.pieza_unica and datos.cantidad_contada > 1:
        raise ErrorInventario(PIEZA_UNICA)
    contar(
        sesion, cantidad_contada=datos.cantidad_contada, variante_id=variante.id, nota=datos.nota
    )
    sesion.commit()
    return _variante_con_existencia(sesion, variante)


def ultimos_movimientos(sesion: Session, condicion) -> list[MovimientoSalida]:
    movimientos = sesion.scalars(
        select(MovimientoInventario)
        .where(condicion)
        .order_by(MovimientoInventario.fecha.desc(), MovimientoInventario.id.desc())
        .limit(100)
    )
    return [MovimientoSalida.model_validate(m, from_attributes=True) for m in movimientos]


@router.get("/variantes/{variante_id}/movimientos")
def movimientos_variante(variante_id: int, sesion: SesionDB) -> list[MovimientoSalida]:
    variante = _variante(sesion, variante_id)
    return ultimos_movimientos(sesion, MovimientoInventario.variante_id == variante.id)
