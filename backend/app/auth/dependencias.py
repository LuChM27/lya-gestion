from datetime import datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from app.auth.seguridad import hash_token
from app.db import SesionDB
from app.modelos import Sesion, Usuario

COOKIE = "lya_sesion"
SIN_SESION = "Inicia sesión para continuar."


def usuario_actual(request: Request, sesion: SesionDB) -> Usuario:
    token = request.cookies.get(COOKIE)
    if token:
        usuario = sesion.scalar(
            select(Usuario)
            .join(Sesion, Sesion.usuario_id == Usuario.id)
            .where(Sesion.token_hash == hash_token(token), Sesion.expira > datetime.now())
        )
        if usuario is not None:
            return usuario
    raise HTTPException(status_code=401, detail=SIN_SESION)


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
