from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.auth.dependencias import COOKIE, UsuarioActual
from app.auth.seguridad import (
    hash_secreto,
    hash_token,
    nuevo_codigo_recuperacion,
    nuevo_token,
    verificar_secreto,
)
from app.db import SesionDB
from app.modelos import Sesion, Usuario

router = APIRouter(prefix="/api/auth")

DURACION_SESION = timedelta(days=30)
MIN_CONTRASENA = 8

CREDENCIALES_MALAS = "Usuario o contraseña incorrectos."
DEMASIADOS_INTENTOS = "Demasiados intentos. Espera un minuto y vuelve a intentarlo."
CUENTA_EXISTE = "La cuenta ya está creada. Inicia sesión."
CONTRASENA_CORTA = "La contraseña debe tener al menos 8 caracteres."
USUARIO_VACIO = "Escribe un usuario."
CODIGO_MALO = "El código de recuperación no es correcto."


class Credenciales(BaseModel):
    usuario: str
    contrasena: str


class Recuperacion(BaseModel):
    codigo: str
    contrasena_nueva: str


def _normalizar(usuario: str) -> str:
    return usuario.strip().lower()


def _validar_contrasena(contrasena: str) -> None:
    if len(contrasena) < MIN_CONTRASENA:
        raise HTTPException(status_code=422, detail=CONTRASENA_CORTA)


def _clave(request: Request) -> str:
    return request.client.host if request.client else "desconocido"


def _revisar_limite(request: Request) -> None:
    if request.app.state.limitador.bloqueado(_clave(request)):
        raise HTTPException(status_code=429, detail=DEMASIADOS_INTENTOS)


def _iniciar_sesion(sesion: Session, usuario: Usuario, respuesta: Response) -> None:
    token = nuevo_token()
    sesion.add(
        Sesion(
            token_hash=hash_token(token),
            usuario_id=usuario.id,
            expira=datetime.now() + DURACION_SESION,
        )
    )
    sesion.commit()
    respuesta.set_cookie(
        COOKIE,
        token,
        max_age=int(DURACION_SESION.total_seconds()),
        httponly=True,
        samesite="strict",
        secure=False,  # HTTP en la red local
    )


@router.get("/estado")
def estado(sesion: SesionDB) -> dict:
    return {"configurado": bool(sesion.scalar(select(func.count(Usuario.id))))}


@router.post("/configurar", status_code=201)
def configurar(datos: Credenciales, respuesta: Response, sesion: SesionDB) -> dict:
    if sesion.scalar(select(func.count(Usuario.id))):
        raise HTTPException(status_code=409, detail=CUENTA_EXISTE)
    nombre = _normalizar(datos.usuario)
    if not nombre:
        raise HTTPException(status_code=422, detail=USUARIO_VACIO)
    _validar_contrasena(datos.contrasena)
    codigo = nuevo_codigo_recuperacion()
    usuario = Usuario(
        usuario=nombre,
        hash_contrasena=hash_secreto(datos.contrasena),
        hash_codigo_recuperacion=hash_secreto(codigo),
        rol="duena",
    )
    sesion.add(usuario)
    sesion.commit()
    _iniciar_sesion(sesion, usuario, respuesta)
    return {"codigo_recuperacion": codigo}


@router.post("/entrar", status_code=204)
def entrar(
    datos: Credenciales,
    request: Request,
    respuesta: Response,
    sesion: SesionDB,
) -> None:
    _revisar_limite(request)
    usuario = sesion.scalar(select(Usuario).where(Usuario.usuario == _normalizar(datos.usuario)))
    if usuario is None or not verificar_secreto(usuario.hash_contrasena, datos.contrasena):
        request.app.state.limitador.registrar_fallo(_clave(request))
        raise HTTPException(status_code=401, detail=CREDENCIALES_MALAS)
    request.app.state.limitador.limpiar(_clave(request))
    _iniciar_sesion(sesion, usuario, respuesta)


@router.post("/salir", status_code=204)
def salir(request: Request, respuesta: Response, sesion: SesionDB) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        sesion.execute(delete(Sesion).where(Sesion.token_hash == hash_token(token)))
        sesion.commit()
    respuesta.delete_cookie(COOKIE, httponly=True, samesite="strict")


@router.get("/yo")
def yo(usuario: UsuarioActual) -> dict:
    return {"usuario": usuario.usuario}


@router.post("/recuperar")
def recuperar(datos: Recuperacion, request: Request, sesion: SesionDB) -> dict:
    _revisar_limite(request)
    _validar_contrasena(datos.contrasena_nueva)
    usuario = sesion.scalar(select(Usuario))
    if usuario is None or not verificar_secreto(usuario.hash_codigo_recuperacion, datos.codigo):
        request.app.state.limitador.registrar_fallo(_clave(request))
        raise HTTPException(status_code=400, detail=CODIGO_MALO)
    request.app.state.limitador.limpiar(_clave(request))
    codigo = nuevo_codigo_recuperacion()
    usuario.hash_contrasena = hash_secreto(datos.contrasena_nueva)
    usuario.hash_codigo_recuperacion = hash_secreto(codigo)
    # Cambiar la contraseña cierra todas las sesiones abiertas.
    sesion.execute(delete(Sesion).where(Sesion.usuario_id == usuario.id))
    sesion.commit()
    return {"codigo_recuperacion": codigo}
