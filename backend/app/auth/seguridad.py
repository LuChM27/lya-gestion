"""Hash de contraseñas y códigos con Argon2id, y tokens de sesión."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # Argon2id por defecto


def hash_secreto(texto: str) -> str:
    return _hasher.hash(texto)


def verificar_secreto(hash_guardado: str, texto: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, texto)
    except (VerificationError, InvalidHashError):
        return False


def nuevo_codigo_recuperacion() -> str:
    return f"{secrets.randbelow(10**8):08d}"


def nuevo_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
