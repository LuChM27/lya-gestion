"""Fotos de productos: se reducen a WebP con miniatura y se guardan con nombre por huella."""

import hashlib
import io
import re
import warnings
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

from app.auth.dependencias import UsuarioActual, usuario_actual
from app.inventario.existencias import ErrorInventario

router = APIRouter()

LADO_GRANDE = 1200
LADO_MINIATURA = 300
CALIDAD = 80
MAX_BYTES = 15 * 1024 * 1024
FORMATOS = {"JPEG", "PNG", "WEBP"}
NOMBRE = re.compile(r"^[0-9a-f]{16}(-300)?\.webp$")
NO_ES_FOTO = "Ese archivo no es una foto."
PESADA = "La foto pesa más de 15 MB."
Image.MAX_IMAGE_PIXELS = 50_000_000


def carpeta_fotos(data_dir: Path) -> Path:
    carpeta = data_dir / "fotos"
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def miniatura(nombre: str) -> str:
    return nombre.replace(".webp", f"-{LADO_MINIATURA}.webp")


def _webp(imagen: Image.Image, lado: int) -> bytes:
    copia = imagen.copy()
    copia.thumbnail((lado, lado))
    salida = io.BytesIO()
    copia.save(salida, "WEBP", quality=CALIDAD)
    return salida.getvalue()


def guardar_foto(datos: bytes, carpeta: Path) -> str:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(datos)) as prueba:
                if prueba.format not in FORMATOS:
                    raise ErrorInventario(NO_ES_FOTO)
                prueba.verify()
            with Image.open(io.BytesIO(datos)) as original:
                imagen = ImageOps.exif_transpose(original)
                if imagen.mode in ("RGBA", "LA", "P"):
                    fondo = Image.new("RGB", imagen.size, "white")
                    fondo.paste(imagen.convert("RGBA"), mask=imagen.convert("RGBA").getchannel("A"))
                    imagen = fondo
                else:
                    imagen = imagen.convert("RGB")
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ErrorInventario(NO_ES_FOTO) from error
    grande = _webp(imagen, LADO_GRANDE)
    nombre = f"{hashlib.sha256(grande).hexdigest()[:16]}.webp"
    (carpeta / nombre).write_bytes(grande)
    (carpeta / miniatura(nombre)).write_bytes(_webp(imagen, LADO_MINIATURA))
    return nombre


def foto_existe(data_dir: Path, nombre: str | None) -> bool:
    return nombre is None or (
        NOMBRE.match(nombre) is not None and (data_dir / "fotos" / nombre).is_file()
    )


@router.post("/api/fotos", status_code=201, dependencies=[Depends(usuario_actual)])
async def subir_foto(archivo: UploadFile, request: Request) -> dict[str, str]:
    datos = await archivo.read(MAX_BYTES + 1)
    if len(datos) > MAX_BYTES:
        raise HTTPException(413, PESADA)
    nombre = guardar_foto(datos, carpeta_fotos(request.app.state.config.data_dir))
    return {"foto": nombre, "miniatura": miniatura(nombre)}


@router.get("/fotos/{nombre}", include_in_schema=False)
def ver_foto(nombre: str, request: Request, _: UsuarioActual) -> FileResponse:
    ruta = request.app.state.config.data_dir / "fotos" / nombre
    if not NOMBRE.match(nombre) or not ruta.is_file():
        raise HTTPException(404)
    return FileResponse(ruta, media_type="image/webp")
