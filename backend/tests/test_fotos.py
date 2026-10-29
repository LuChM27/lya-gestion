import inspect
import io
import os
import time

from PIL import Image

from tests.test_productos import MODELO


def jpeg(ancho: int, alto: int, orientacion: int | None = None) -> bytes:
    salida = io.BytesIO()
    imagen = Image.new("RGB", (ancho, alto), (217, 72, 126))
    exif = Image.Exif()
    if orientacion:
        exif[0x0112] = orientacion
    imagen.save(salida, "JPEG", exif=exif)
    return salida.getvalue()


def subir(c, datos: bytes, nombre="a.jpg", tipo="image/jpeg"):
    return c.post("/api/fotos", files={"archivo": (nombre, datos, tipo)})


def test_subir_foto_reduce_y_crea_miniatura(autenticado, config_tmp):
    r = subir(autenticado, jpeg(4000, 3000))
    assert r.status_code == 201, r.text
    foto, miniatura = r.json()["foto"], r.json()["miniatura"]
    assert miniatura == foto.replace(".webp", "-300.webp")
    with Image.open(config_tmp.data_dir / "fotos" / foto) as im:
        assert im.format == "WEBP" and im.size == (1200, 900)
    with Image.open(config_tmp.data_dir / "fotos" / miniatura) as im:
        assert im.size == (300, 225)


def test_foto_pequena_no_se_agranda(autenticado, config_tmp):
    r = subir(autenticado, jpeg(200, 100))
    with Image.open(config_tmp.data_dir / "fotos" / r.json()["foto"]) as im:
        assert im.size == (200, 100)


def test_foto_girada_por_exif_queda_derecha(autenticado, config_tmp):
    r = subir(autenticado, jpeg(400, 300, orientacion=6))
    with Image.open(config_tmp.data_dir / "fotos" / r.json()["foto"]) as im:
        assert im.size == (300, 400)


def test_png_con_transparencia(autenticado):
    salida = io.BytesIO()
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(salida, "PNG")
    assert subir(autenticado, salida.getvalue(), "a.png", "image/png").status_code == 201


def test_archivo_que_no_es_foto_da_422(autenticado):
    r = subir(autenticado, b"%PDF-1.4 esto no es una foto", "a.pdf", "application/pdf")
    assert r.status_code == 422 and r.json()["detail"] == "Ese archivo no es una foto."


def test_formato_no_permitido_da_422(autenticado):
    salida = io.BytesIO()
    Image.new("RGB", (10, 10)).save(salida, "GIF")
    r = subir(autenticado, salida.getvalue(), "a.gif", "image/gif")
    assert r.status_code == 422 and r.json()["detail"] == "Ese archivo no es una foto."


def test_foto_muy_pesada_da_413(autenticado):
    r = subir(autenticado, b"\xff" * (15 * 1024 * 1024 + 1))
    assert r.status_code == 413 and r.json()["detail"] == "La foto pesa más de 15 MB."


def test_subir_exige_sesion(cliente):
    assert subir(cliente, jpeg(10, 10)).status_code == 401


def test_ver_foto_exige_sesion_y_tiene_cache_inmutable(autenticado):
    foto = subir(autenticado, jpeg(100, 100)).json()["foto"]
    r = autenticado.get(f"/fotos/{foto}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp"
    assert r.headers["cache-control"] == "private, max-age=31536000, immutable"
    autenticado.post("/api/auth/salir")
    r = autenticado.get(f"/fotos/{foto}")
    assert r.status_code == 401 and r.headers["cache-control"] == "no-store"


def test_foto_inexistente_da_404_sin_cache(autenticado):
    r = autenticado.get("/fotos/0123456789abcdef.webp")
    assert r.status_code == 404 and r.headers["cache-control"] == "no-store"


def test_nombre_de_foto_raro_nunca_entrega_la_base(autenticado):
    assert autenticado.get("/fotos/lya.db").status_code == 404
    # Con %2F la ruta ya no es de fotos: cae en la interfaz (503 aquí, sin interfaz instalada).
    for ruta in ("/fotos/..%2F..%2Flya.db", "/fotos/../lya.db", "/fotos/..%2Flya.db"):
        r = autenticado.get(ruta)
        assert r.status_code in (404, 503) and b"SQLite" not in r.content, ruta


def test_modelo_con_foto_inexistente_da_422(autenticado):
    r = autenticado.post("/api/inventario/modelos", json=MODELO | {"foto": "0123456789abcdef.webp"})
    assert r.status_code == 422 and r.json()["detail"] == "Vuelve a subir la foto."


def test_modelo_con_foto_subida(autenticado):
    foto = subir(autenticado, jpeg(100, 100)).json()["foto"]
    r = autenticado.post("/api/inventario/modelos", json=MODELO | {"foto": foto})
    assert r.status_code == 201 and r.json()["foto"] == foto
    m = r.json()
    r = autenticado.post(
        f"/api/inventario/modelos/{m['id']}/variantes",
        json={"color": "Negro", "foto": "fedcba9876543210.webp"},
    )
    assert r.status_code == 422 and r.json()["detail"] == "Vuelve a subir la foto."


def test_subir_foto_no_bloquea_el_servidor():
    # Pillow trabaja varios segundos con fotos grandes: la ruta corre en un hilo aparte.
    from app.inventario.fotos import subir_foto

    assert not inspect.iscoroutinefunction(subir_foto)


def test_foto_reemplazada_se_borra_si_nadie_la_usa(autenticado, config_tmp):
    carpeta = config_tmp.data_dir / "fotos"
    vieja = subir(autenticado, jpeg(100, 100)).json()["foto"]
    nueva = subir(autenticado, jpeg(120, 100)).json()["foto"]
    m = autenticado.post("/api/inventario/modelos", json=MODELO | {"foto": vieja}).json()
    r = autenticado.put(f"/api/inventario/modelos/{m['id']}", json=MODELO | {"foto": nueva})
    assert r.status_code == 200
    assert not (carpeta / vieja).exists()
    assert not (carpeta / vieja.replace(".webp", "-300.webp")).exists()
    assert (carpeta / nueva).exists()


def test_foto_compartida_no_se_borra(autenticado, config_tmp):
    carpeta = config_tmp.data_dir / "fotos"
    foto = subir(autenticado, jpeg(100, 100)).json()["foto"]
    m = autenticado.post("/api/inventario/modelos", json=MODELO | {"foto": foto}).json()
    v = autenticado.post(
        f"/api/inventario/modelos/{m['id']}/variantes", json={"color": "Negro", "foto": foto}
    ).json()
    autenticado.put(f"/api/inventario/modelos/{m['id']}", json=MODELO | {"foto": None})
    assert (carpeta / foto).exists()
    autenticado.delete(f"/api/inventario/variantes/{v['id']}")
    assert not (carpeta / foto).exists()


def test_fotos_sin_guardar_se_borran_al_dia_siguiente(autenticado, config_tmp):
    carpeta = config_tmp.data_dir / "fotos"
    olvidada = subir(autenticado, jpeg(100, 100)).json()["foto"]
    usada = subir(autenticado, jpeg(110, 100)).json()["foto"]
    autenticado.post("/api/inventario/modelos", json=MODELO | {"foto": usada})
    ayer = time.time() - 25 * 3600
    for nombre in (olvidada, usada):
        for archivo in (nombre, nombre.replace(".webp", "-300.webp")):
            os.utime(carpeta / archivo, (ayer, ayer))
    reciente = subir(autenticado, jpeg(120, 100)).json()["foto"]
    assert not (carpeta / olvidada).exists()
    assert not (carpeta / olvidada.replace(".webp", "-300.webp")).exists()
    assert (carpeta / usada).exists()
    assert (carpeta / reciente).exists()
