# Inventario de productos e insumos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ella pueda cargar su catálogo (modelos con variantes de color o piezas únicas, con foto) y sus insumos (con unidad, precio vigente e historial), registrar entradas, conteos, ajustes y mermas, y ver de un vistazo qué está por agotarse. Funciona igual en la Mac y en el iPhone.

**Architecture:** Esta parte añade un paquete `app/inventario/` con modelos SQLAlchemy, una migración `0002` y rutas `/api/inventario/*`. La existencia no se guarda en ninguna columna: es la suma de `MovimientoInventario.cantidad`, así no hay un contador que se descuadre. Ventas, compras y producción (planes siguientes) solo añaden movimientos con `registrar_movimiento`. Las fotos se reducen en el navegador antes de subirlas y Pillow las vuelve a codificar a WebP. Se guardan en `DATA_DIR/fotos` con nombre por huella y se sirven en `/fotos/*`, con sesión obligatoria y caché inmutable. En la interfaz entran un marco con navegación (abajo en el celular, a la izquierda en la Mac) y las pantallas Productos e Insumos.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic, Pillow; React 19, react-router-dom 7, Tailwind v4, Vitest.

**Spec:** `docs/arquitectura.md`: secciones «Módulos funcionales» (fila Inventario, avisos de stock, reglas de negocio), «Modelo de datos» (Modelo, Variante, Insumo, PrecioInsumo, MovimientoInventario), «Arquitectura técnica» (fila Fotos y caché) y «Seguridad, requisitos no funcionales e identidad visual».

**Rama:** `inventario`, creada desde `base-ejecutable` (el PR #54 todavía no se ha unido a `main`).

## Global Constraints

- Todo lo de la base ejecutable sigue vigente: Python 3.13, ruedas para macOS 12 x86_64 y arm64, `safari17`, sin CDN, `/api/*` con `no-store`, textos en español de Colombia con botones que empiezan por verbo, sin «OK» ni «Enviar».
- Categorías de modelo: `crochet`, `murano`, `cristal`, `otro`. Tipos de insumo: `hilo`, `cuentas`, `herraje`, `forro`, `argolla`, `empaque`, `otro`.
- La unidad del insumo la escribe ella (texto libre, máximo 20 caracteres: «metros», «gramos», «unidades»…). La conversión de compra es opcional: nombre de la unidad de compra («cono») y cuántas unidades base trae (400).
- Las cantidades admiten decimales (`Numeric(12, 3)`): 0,5 paquetes o 12,5 m. Los precios por unidad se guardan como `Numeric(12, 2)`. En pantalla los montos van en pesos sin decimales (`$ 125.000`) y las cantidades con coma decimal y hasta 3 decimales.
- Los precios nunca se sobrescriben: cada cambio crea un `PrecioInsumo(insumo, precio_unitario, desde, origen)`, con `origen` en `edicion` o `compra`. El precio vigente es el de mayor `(desde, id)`.
- Tipos de `MovimientoInventario` según la spec: `compra`, `inicio_produccion`, `consumo`, `liberacion`, `ingreso_vitrina`, `venta`, `devolucion`, `cambio`, `ajuste`, `merma`. Este plan usa `compra`, `ingreso_vitrina`, `ajuste` y `merma`.
- Estado de stock: `bajo_minimo` si existencia < mínimo; `por_agotarse` si existencia ≤ mínimo × 1,25; si no, `ok`. Con mínimo 0 solo cuenta `bajo_minimo` cuando la existencia es negativa. Colores: rojo para `bajo_minimo`, amarillo para `por_agotarse`.
- Fotos: lado mayor 1200 px y miniatura de 300 px, en WebP con calidad 80. Archivo de hasta 15 MB. Se aceptan JPEG, PNG y WebP.
- Celular: pantallas desde 360 px y botones de al menos 44 px. Fechas DD/MM/AAAA, zona `America/Bogota`.
- Versión al terminar: `0.2.0`.

## Review Focus

- **Merma o ajuste que dejaría negativa la existencia de una variante o de un insumo.** La merma debe dar 422 «Solo hay N». El conteo nunca falla, porque fija la cantidad contada. Prueba en la Tarea 2.
- **Foto HEIC desde el Safari de la Mac, foto girada del iPhone (EXIF) y archivo que no es imagen.** HEIC: se convierte en el navegador; si el navegador no puede, sale un error claro. EXIF: se guarda derecha. Archivo que no es imagen: 422 «Ese archivo no es una foto.». Pruebas en las Tareas 5 y 7.
- **Borrar un modelo, una variante o un insumo con movimientos.** No se borra: se archiva (`activo = false`) y desaparece de las listas, pero su historial sigue. Sin movimientos sí se borra. Pruebas en las Tareas 3 y 4.
- **Números escritos con coma decimal en el celular** («12,5»). Se interpretan como 12,5, no como 125 ni como error. Prueba en la Tarea 6.
- **Dos variantes del mismo modelo con el mismo color, o un SKU repetido.** 409 con un mensaje claro, sin error 500. Prueba en la Tarea 3.

---

## Estructura de archivos

```
backend/app/inventario/
  __init__.py
  modelos.py       Modelo, Variante, Insumo, PrecioInsumo, MovimientoInventario
  existencias.py   existencia(), estado_stock(), registrar_movimiento(), conteo()
  esquemas.py      modelos Pydantic de entrada y salida
  productos.py     router /api/inventario/modelos y /variantes
  insumos.py       router /api/inventario/insumos
  fotos.py         guardar_foto(), router POST /api/fotos y GET /fotos/{nombre}
backend/migraciones/versions/0002_inventario.py
backend/tests/test_existencias.py, test_productos.py, test_insumos.py, test_fotos.py
frontend/src/
  formato.ts                  pesos(), cantidad(), leerNumero(), fecha()
  componentes/Marco.tsx       encabezado + navegación + <Outlet/>
  componentes/Estado.tsx      etiqueta de estado de stock
  componentes/SubirFoto.tsx   reduce en el navegador y sube
  paginas/Productos.tsx, Modelo.tsx, Insumos.tsx, Insumo.tsx
  (pruebas junto a cada archivo: *.test.tsx / formato.test.ts)
```

---

### Tarea 1: Modelos de inventario y migración

**Files:**
- Create: `backend/app/inventario/__init__.py`, `backend/app/inventario/modelos.py`, `backend/migraciones/versions/0002_inventario.py`
- Modify: `backend/migraciones/env.py` (importar los modelos nuevos para `target_metadata`, si hace falta)
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Consumes: `Base` de `app/modelos.py`, `migrar`, `crear_motor`.
- Produces (todas con `id` entero):
  - `Modelo(nombre str(120), categoria str(20), precio_venta int, horas_tejido Numeric(6,2) = 0, foto str(80)|None, activo bool = True, creado datetime)`.
  - `Variante(modelo_id → Modelo CASCADE, color str(120), sku str(30) único, stock_minimo Numeric(12,3) = 0, foto str|None, pieza_unica bool = False, activo bool = True)`, con `UniqueConstraint(modelo_id, color)`.
  - `Insumo(nombre str(120) único, tipo str(20), unidad str(20), unidad_compra str(20)|None, factor_compra Numeric(12,3)|None, stock_minimo Numeric(12,3) = 0, proveedor str(120)|None, activo bool = True)`.
  - `PrecioInsumo(insumo_id → Insumo CASCADE, precio_unitario Numeric(12,2), desde datetime, origen str(20))`.
  - `MovimientoInventario(fecha datetime, tipo str(20), cantidad Numeric(12,3) con signo, costo_unitario Numeric(12,2)|None, nota str(200)|None, variante_id → Variante|None, insumo_id → Insumo|None)`, con `CheckConstraint` de que exactamente uno de `variante_id` o `insumo_id` no es nulo, e índices en `(variante_id)` y `(insumo_id)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_migrar_crea_tablas_de_inventario(config_tmp):
    migrar(config_tmp)
    tablas = set(inspect(crear_motor(config_tmp)).get_table_names())
    assert {"modelo", "variante", "insumo", "precio_insumo", "movimiento_inventario"} <= tablas

def test_movimiento_exige_variante_o_insumo(config_tmp):
    migrar(config_tmp)
    with Session(crear_motor(config_tmp)) as s:
        s.add(MovimientoInventario(tipo="ajuste", cantidad=1))
        with pytest.raises(IntegrityError):
            s.commit()
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_db.py -q`
Expected: FAIL (`ImportError` de `app.inventario.modelos`).

- [ ] **Paso 3: Implementar los modelos y `0002_inventario`** (escrita a mano igual que la `0001`, con `down_revision = "0001"`)

- [ ] **Paso 4: Correr toda la suite**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit** `git commit -m "Modelos de inventario: modelo, variante, insumo, precios y movimientos"`

---

### Tarea 2: Existencias y movimientos

**Files:**
- Create: `backend/app/inventario/existencias.py`
- Test: `backend/tests/test_existencias.py`

**Interfaces:**
- Consumes: modelos de la Tarea 1.
- Produces:
  - `class ErrorInventario(Exception)`: lleva `mensaje: str`, y las rutas lo traducen a 422.
  - `existencia(sesion, *, variante_id: int | None = None, insumo_id: int | None = None) -> Decimal`: `SUM(cantidad)`, o 0 si no hay movimientos.
  - `existencias(sesion, *, variantes: list[int] | None = None, insumos: list[int] | None = None) -> dict[int, Decimal]`: una sola consulta agrupada, para las listas.
  - `estado_stock(existencia: Decimal, minimo: Decimal) -> Literal["ok", "por_agotarse", "bajo_minimo"]`.
  - `registrar_movimiento(sesion, *, tipo: str, cantidad: Decimal, variante_id=None, insumo_id=None, costo_unitario=None, nota=None, permitir_negativo=False) -> MovimientoInventario`. Si el tipo no está en la lista de la spec: `ValueError`. Con cantidad 0: `ErrorInventario("La cantidad no puede ser 0.")`. Si el resultado quedaría por debajo de 0 y no se permite negativo: `ErrorInventario(f"Solo hay {cantidad_texto(existencia)}.")`. No hace commit.
  - `contar(sesion, *, cantidad_contada: Decimal, variante_id=None, insumo_id=None, nota=None) -> MovimientoInventario | None`: crea un `ajuste` por la diferencia, o `None` si no hay diferencia. Con cantidad contada negativa: `ErrorInventario("El conteo no puede ser negativo.")`.
  - `cantidad_texto(d: Decimal) -> str`: coma decimal y sin ceros sobrantes (`Decimal("12.500")` da `"12,5"`, `Decimal("3")` da `"3"`).

- [ ] **Paso 1: Escribir las pruebas que fallan** (sesión sobre una base migrada en `tmp_path`, con un modelo, una variante y un insumo creados en una fixture)

```python
def test_existencia_es_la_suma_de_movimientos(s, variante):
    registrar_movimiento(s, tipo="ingreso_vitrina", cantidad=Decimal(3), variante_id=variante.id)
    registrar_movimiento(s, tipo="merma", cantidad=Decimal(-1), variante_id=variante.id)
    assert existencia(s, variante_id=variante.id) == 2

def test_merma_mayor_que_la_existencia_falla(s, insumo):
    registrar_movimiento(s, tipo="compra", cantidad=Decimal("12.5"), insumo_id=insumo.id)
    with pytest.raises(ErrorInventario, match="Solo hay 12,5."):
        registrar_movimiento(s, tipo="merma", cantidad=Decimal(-13), insumo_id=insumo.id)

def test_conteo_crea_ajuste_por_la_diferencia(s, insumo):
    registrar_movimiento(s, tipo="compra", cantidad=Decimal(10), insumo_id=insumo.id)
    m = contar(s, cantidad_contada=Decimal(7), insumo_id=insumo.id)
    assert m.tipo == "ajuste" and m.cantidad == -3
    assert contar(s, cantidad_contada=Decimal(7), insumo_id=insumo.id) is None

def test_conteo_negativo_falla(s, insumo): ...

@pytest.mark.parametrize("exist,minimo,esperado", [
    (Decimal(11), Decimal(8), "ok"), (Decimal(10), Decimal(8), "por_agotarse"), (Decimal(8), Decimal(8), "por_agotarse"),
    (Decimal(7), Decimal(8), "bajo_minimo"), (Decimal(0), Decimal(0), "ok"),
    (Decimal(-1), Decimal(0), "bajo_minimo"),
])
def test_estado_stock(exist, minimo, esperado): ...

def test_existencias_agrupa_en_una_consulta(s, variante): ...  # dict con 0 para la que no tiene movimientos
def test_cantidad_cero_falla(s, insumo): ...
def test_tipo_desconocido_falla(s, insumo): ...  # ValueError
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_existencias.py -q`
Expected: FAIL (`ImportError`).

- [ ] **Paso 3: Implementar `existencias.py`**

- [ ] **Paso 4: Correr toda la suite**

Run: `uv run pytest -q`
Expected: todas pasan.

- [ ] **Paso 5: Commit** `git commit -m "Existencias como suma de movimientos, conteo y estado de stock"`

---

### Tarea 3: API de productos (modelos y variantes)

**Files:**
- Create: `backend/app/inventario/esquemas.py`, `backend/app/inventario/productos.py`
- Modify: `backend/app/principal.py` (incluir el router antes de `registrar_web`)
- Test: `backend/tests/test_productos.py`

**Interfaces:**
- Consumes: `UsuarioActual`, `SesionDB` y todo `existencias.py`. Las fotos se guardan aquí como nombres de archivo, que produce la Tarea 5. En esta tarea se aceptan como `str | None` sin validar su existencia.
- Produces (todas exigen sesión; un `ErrorInventario` responde 422 con su mensaje):
  - `GET /api/inventario/modelos?buscar=&categoria=&archivados=false` devuelve una lista de `ModeloResumen{id, nombre, categoria, precio_venta, foto, activo, unidades: Decimal, variantes: int, estado}`. `unidades` suma las variantes activas y `estado` es el peor de ellas. Orden: `bajo_minimo`, luego `por_agotarse`, luego nombre. La búsqueda ignora mayúsculas y tildes, y busca en nombre, color y SKU.
  - `POST /api/inventario/modelos` recibe `ModeloEntrada{nombre, categoria, precio_venta >= 0, horas_tejido >= 0, foto?}` y responde 201 con `ModeloDetalle`.
  - `GET /api/inventario/modelos/{id}` devuelve `ModeloDetalle` = `ModeloResumen` + `horas_tejido` + `variantes: list[VarianteSalida{id, color, sku, stock_minimo, foto, pieza_unica, activo, existencia, estado}]`.
  - `PUT /api/inventario/modelos/{id}` recibe `ModeloEntrada`.
  - `DELETE /api/inventario/modelos/{id}` responde 204. Si alguna variante tiene movimientos, archiva el modelo y sus variantes; si no, lo borra.
  - `POST /api/inventario/modelos/{id}/variantes` recibe `VarianteEntrada{color, sku?, stock_minimo >= 0, foto?, pieza_unica}` y responde 201 con `VarianteSalida`. Sin SKU se genera `LA-{id:04d}`. Un color repetido en el mismo modelo da 409 «Ya existe la variante {color} en este modelo.»; un SKU repetido da 409 «El código {sku} ya está en uso.». Una pieza única fija `stock_minimo = 0`.
  - `PUT /api/inventario/variantes/{id}` y `DELETE /api/inventario/variantes/{id}`: el DELETE sigue la misma regla de archivar o borrar.
  - `POST /api/inventario/variantes/{id}/movimientos` recibe `MovimientoEntrada{tipo: "ingreso_vitrina" | "merma", cantidad > 0, nota?}`. La merma se guarda con signo negativo. Responde 201 con `VarianteSalida`. Una pieza única con existencia 1 que recibe otro ingreso da 422 «Una pieza única solo puede tener 1 unidad.».
  - `POST /api/inventario/variantes/{id}/conteo` recibe `{cantidad_contada >= 0, nota?}` y devuelve `VarianteSalida`.
  - `GET /api/inventario/variantes/{id}/movimientos` devuelve los últimos 100 como `list[MovimientoSalida{id, fecha, tipo, cantidad, nota}]`, del más nuevo al más viejo.
- Todos los `Decimal` se serializan como número JSON (`float`), no como texto.

- [ ] **Paso 1: Escribir las pruebas que fallan** (fixture `autenticado`: crea la cuenta con `/api/auth/configurar` sobre `cliente`)

```python
def test_sin_sesion_responde_401(cliente):
    assert cliente.get("/api/inventario/modelos").status_code == 401

def test_crear_modelo_con_variantes_y_stock(autenticado):
    m = autenticado.post("/api/inventario/modelos", json={"nombre": "Bolso balde", "categoria": "crochet", "precio_venta": 125000, "horas_tejido": 6}).json()
    v = autenticado.post(f"/api/inventario/modelos/{m['id']}/variantes", json={"color": "Rosa palo", "stock_minimo": 2}).json()
    assert v["sku"] == f"LA-{v['id']:04d}"
    autenticado.post(f"/api/inventario/variantes/{v['id']}/movimientos", json={"tipo": "ingreso_vitrina", "cantidad": 2})
    d = autenticado.get(f"/api/inventario/modelos/{m['id']}").json()
    assert d["unidades"] == 2 and d["variantes"][0]["estado"] == "por_agotarse"

def test_color_repetido_da_409(autenticado, modelo): ...
def test_sku_repetido_da_409(autenticado, modelo): ...
def test_merma_mayor_que_la_existencia_da_422(autenticado, variante): ...   # detail == "Solo hay 0."
def test_pieza_unica_no_pasa_de_una_unidad(autenticado, modelo): ...
def test_borrar_modelo_con_movimientos_lo_archiva(autenticado, variante):
    # tras DELETE: no sale en la lista por defecto, sí con ?archivados=true, y sus movimientos siguen
def test_borrar_modelo_sin_movimientos_lo_elimina(autenticado, modelo): ...  # GET → 404
def test_buscar_ignora_tildes_y_mayusculas(autenticado):
    # modelo "Cartera Murano" con variante "Azul cielo": buscar=murano y buscar=AZUL lo encuentran
def test_lista_pone_primero_lo_bajo_minimo(autenticado): ...
def test_respuestas_no_store(autenticado): ...  # Cache-Control: no-store en GET modelos
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_productos.py -q`
Expected: FAIL (404 en las rutas).

- [ ] **Paso 3: Implementar `esquemas.py` y `productos.py`, e incluir el router.** La búsqueda sin tildes se resuelve en Python con `unicodedata.normalize("NFKD")` sobre los resultados ya filtrados por categoría. Con cientos de modelos alcanza y evita una función SQL propia.

- [ ] **Paso 4: Correr toda la suite y ruff**

Run: `uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Paso 5: Commit** `git commit -m "API de productos: modelos, variantes, ingreso a vitrina, mermas y conteo"`

---

### Tarea 4: API de insumos con precio vigente e historial

**Files:**
- Create: `backend/app/inventario/insumos.py`
- Modify: `backend/app/inventario/esquemas.py`, `backend/app/principal.py`
- Test: `backend/tests/test_insumos.py`

**Interfaces:**
- Consumes: `existencias.py`, esquemas de la Tarea 3.
- Produces:
  - `precio_vigente(sesion, insumo_id) -> Decimal | None`, en `insumos.py`.
  - `GET /api/inventario/insumos?buscar=&tipo=&archivados=false` devuelve una lista de `InsumoSalida{id, nombre, tipo, unidad, unidad_compra, factor_compra, stock_minimo, proveedor, activo, precio_unitario, existencia, estado}`, en el mismo orden que los productos.
  - `POST /api/inventario/insumos` recibe `InsumoEntrada{nombre, tipo, unidad (1–20), unidad_compra?, factor_compra? > 0, stock_minimo >= 0, proveedor?, precio_unitario? >= 0}` y responde 201. `unidad_compra` y `factor_compra` van juntos o ninguno; si llega uno solo, 422 «Escribe la unidad de compra y cuánto trae.». Un nombre repetido (sin distinguir mayúsculas) da 409 «Ya existe el insumo {nombre}.». Si llega precio, crea un `PrecioInsumo` con origen `edicion`.
  - `PUT /api/inventario/insumos/{id}` recibe `InsumoEntrada`. Solo crea un `PrecioInsumo` nuevo si el precio cambió.
  - `DELETE /api/inventario/insumos/{id}`: archiva o borra con la misma regla.
  - `GET /api/inventario/insumos/{id}/precios` devuelve `list[{precio_unitario, desde, origen}]`, del más nuevo al más viejo.
  - `POST /api/inventario/insumos/{id}/entradas` recibe `EntradaInsumo{cantidad > 0, en_unidad_compra: bool = False, precio_unitario? >= 0, nota?}` y crea un movimiento `compra`. Con `en_unidad_compra`, la cantidad se multiplica por `factor_compra`; si el insumo no tiene factor, 422. Si llega precio, se interpreta por unidad de compra cuando `en_unidad_compra`, y se divide entre el factor antes de guardarlo. El movimiento guarda ese `costo_unitario`, y si difiere del vigente se crea un `PrecioInsumo` con origen `compra`. Responde 201 con `InsumoSalida`.
  - `POST /api/inventario/insumos/{id}/movimientos` recibe `{tipo: "merma", cantidad > 0, nota?}`.
  - `POST /api/inventario/insumos/{id}/conteo` y `GET /api/inventario/insumos/{id}/movimientos` funcionan igual que en las variantes.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```python
def test_entrada_en_unidad_de_compra_convierte(autenticado):
    i = crear_insumo(autenticado, nombre="Hilo algodón rosa", tipo="hilo", unidad="metros", unidad_compra="cono", factor_compra=400)
    r = autenticado.post(f"/api/inventario/insumos/{i['id']}/entradas", json={"cantidad": 2, "en_unidad_compra": True, "precio_unitario": 12000})
    assert r.json()["existencia"] == 800 and r.json()["precio_unitario"] == 30

def test_cambiar_precio_guarda_historial(autenticado):
    # crear con 30, PUT con 35, PUT con 35 otra vez → historial [35 edicion, 30 edicion]
def test_entrada_sin_factor_en_unidad_de_compra_da_422(autenticado): ...
def test_conversion_a_medias_da_422(autenticado): ...
def test_nombre_repetido_da_409_sin_importar_mayusculas(autenticado): ...
def test_merma_de_insumo_mayor_que_existencia_da_422(autenticado): ...
def test_borrar_insumo_con_movimientos_lo_archiva(autenticado): ...
def test_cantidades_decimales(autenticado):
    # entrada de 12.5 → existencia 12.5 (no 12 ni 13)
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_insumos.py -q`
Expected: FAIL (404).

- [ ] **Paso 3: Implementar `insumos.py`**

- [ ] **Paso 4: Correr toda la suite y ruff**

Run: `uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Paso 5: Commit** `git commit -m "API de insumos: unidad de compra, entradas, precio vigente con historial, mermas y conteo"`

---

### Tarea 5: Fotos

**Files:**
- Create: `backend/app/inventario/fotos.py`
- Modify: `backend/pyproject.toml` y `uv.lock` (Pillow como dependencia de ejecución), `backend/app/principal.py`, `backend/app/web.py` (regla de caché de `/fotos/`), `backend/app/inventario/productos.py` (validar que la foto exista)
- Test: `backend/tests/test_fotos.py`

**Interfaces:**
- Consumes: `Config.data_dir`, `UsuarioActual`.
- Produces:
  - `guardar_foto(datos: bytes, carpeta: Path) -> str`. Abre la imagen con Pillow, aplica `ImageOps.exif_transpose` y la convierte a RGB. Guarda `{huella}.webp` (lado mayor ≤ 1200) y `{huella}-300.webp` (lado mayor ≤ 300), los dos con calidad 80, y devuelve `"{huella}.webp"`. La huella son los primeros 16 caracteres hexadecimales del sha256 de los bytes WebP grandes. Si Pillow no reconoce el archivo o el formato no está entre JPEG, PNG y WebP: `ErrorInventario("Ese archivo no es una foto.")`. Fija `Image.MAX_IMAGE_PIXELS = 50_000_000`.
  - `POST /api/fotos`: multipart con el campo `archivo`, máximo 15 MB (si se pasa, 413 «La foto pesa más de 15 MB.»). Responde 201 con `{"foto": nombre, "miniatura": nombre_300}`.
  - `GET /fotos/{nombre}`: exige sesión. El nombre debe cumplir `^[0-9a-f]{16}(-300)?\.webp$`; si no, 404. Devuelve `image/webp` con `Cache-Control: private, max-age=31536000, immutable`. Se registra antes de la ruta comodín de `web.py`.
  - En `web.py`, `_regla_de_cache` devuelve `"private, max-age=31536000, immutable"` para `/fotos/`, y no-store si el estado no es 200.
  - Productos e insumos devuelven `foto` tal cual; la interfaz arma la miniatura con `foto.replace(".webp", "-300.webp")`. Al crear o editar un modelo o una variante con una `foto` que no existe en disco: 422 «Vuelve a subir la foto.».

- [ ] **Paso 1: Escribir las pruebas que fallan** (las imágenes se crean en memoria con Pillow)

```python
def test_subir_foto_reduce_y_crea_miniatura(autenticado, config_tmp):
    r = autenticado.post("/api/fotos", files={"archivo": ("a.jpg", jpeg(4000, 3000), "image/jpeg")})
    assert r.status_code == 201
    with Image.open(config_tmp.data_dir / "fotos" / r.json()["foto"]) as im:
        assert im.size == (1200, 900)
    with Image.open(config_tmp.data_dir / "fotos" / r.json()["miniatura"]) as im:
        assert max(im.size) == 300

def test_foto_girada_por_exif_queda_derecha(autenticado, config_tmp):
    # JPEG 400x300 con EXIF Orientation=6 → guardado 300x400
def test_archivo_que_no_es_foto_da_422(autenticado): ...
def test_foto_muy_pesada_da_413(autenticado): ...
def test_ver_foto_exige_sesion_y_tiene_cache_inmutable(cliente, autenticado): ...
def test_nombre_de_foto_raro_da_404(autenticado):
    assert autenticado.get("/fotos/..%2F..%2Flya.db").status_code == 404
def test_modelo_con_foto_inexistente_da_422(autenticado): ...
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `uv run pytest tests/test_fotos.py -q`
Expected: FAIL (404).

- [ ] **Paso 3: Agregar Pillow e implementar**

Run: `uv add pillow`, y después `uv run --with pillow python empaquetado/revisar_ruedas.py` como en CI. Debe aceptar las ruedas de Pillow para macOS 12 x86_64 y arm64; si no, fijar una versión que las tenga y anotar la decisión.
Pillow lee el archivo dentro de `Image.open(...)` con `im.verify()` antes de usarlo, y vuelve a abrirlo para procesarlo.

- [ ] **Paso 4: Correr toda la suite y ruff**

Run: `uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Paso 5: Commit** `git commit -m "Fotos: reducción a WebP con miniatura, orientación EXIF y caché privada inmutable"`

---

### Tarea 6: Marco de la app y formatos

**Files:**
- Create: `frontend/src/formato.ts`, `frontend/src/formato.test.ts`, `frontend/src/componentes/Marco.tsx`, `frontend/src/componentes/Estado.tsx`
- Modify: `frontend/src/App.tsx` (rutas anidadas bajo el marco), `frontend/src/paginas/Inicio.tsx` (sin encabezado propio), `frontend/src/api.ts` (`actualizar`, `borrar`, `subir`), `frontend/src/App.test.tsx`

**Interfaces:**
- Produces:
  - `pesos(n: number): string` da `"$ 125.000"`, con `Intl.NumberFormat("es-CO", {style: "currency", currency: "COP", maximumFractionDigits: 0})` y el espacio normalizado a `" "`.
  - `cantidad(n: number): string` da `"12,5"`: hasta 3 decimales, sin ceros sobrantes y con separador de miles «.».
  - `leerNumero(texto: string): number | null`: acepta `"12,5"`, `"12.5"`, `"1.200"` (que es 1200), `"1.200,5"` y `" 3 "`. Devuelve `null` si el texto está vacío o no es un número. Regla: si hay coma, los puntos son miles; si no hay coma y el punto va seguido de exactamente 3 dígitos al final, es separador de miles; si no, es decimal.
  - `fecha(iso: string): string` da `"DD/MM/AAAA"` en `America/Bogota`.
  - `actualizar<T>(ruta, cuerpo)` hace PUT, `borrar(ruta)` hace DELETE y `subir<T>(ruta, form: FormData)` hace POST sin `Content-Type`, para que el navegador ponga el boundary.
  - `<Marco usuario>`: encabezado con «L&A» y «Salir», y navegación con «Inicio» (`/`), «Productos» (`/productos`) e «Insumos» (`/insumos`). En pantallas angostas va fija abajo, con botones de 44 px de alto; desde `md` va a la izquierda. Marca el enlace activo con `aria-current="page"`. Al final, `<Outlet/>`.
  - `<Estado estado>`: no muestra nada si es `ok`. Con `por_agotarse` muestra «Por agotarse» en amarillo; con `bajo_minimo`, «Bajo mínimo» en rojo. Los colores van en `tema.css`: `--color-alerta` y `--color-peligro`, también en tema oscuro.
  - Rutas: `/` (Inicio), `/productos`, `/productos/:id`, `/insumos` e `/insumos/:id`, todas dentro de `Protegida` → `Marco`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
test.each([["12,5", 12.5], ["12.5", 12.5], ["1.200", 1200], ["1.200,5", 1200.5], [" 3 ", 3], ["", null], ["abc", null]])("leerNumero(%s)", (t, n) => expect(leerNumero(t)).toBe(n));
test("pesos", () => expect(pesos(125000)).toBe("$ 125.000"));
test("cantidad", () => { expect(cantidad(12.5)).toBe("12,5"); expect(cantidad(3)).toBe("3"); expect(cantidad(1200)).toBe("1.200"); });
test("fecha en Bogotá", () => expect(fecha("2026-10-29T03:00:00Z")).toBe("28/10/2026"));
```

En `App.test.tsx`: con sesión, la navegación muestra «Productos» e «Insumos», y al hacer clic en «Productos» la ruta cambia y el enlace queda con `aria-current="page"`.

- [ ] **Paso 2: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL (módulo `./formato` inexistente).

- [ ] **Paso 3: Implementar**

- [ ] **Paso 4: Correr pruebas, lint y build**

Run: `npm test && npx oxlint && npm run build`
Expected: todo pasa.

- [ ] **Paso 5: Commit** `git commit -m "Marco con navegación para celular y Mac, y formatos de pesos, cantidades y fechas"`

---

### Tarea 7: Pantallas de productos

**Files:**
- Create: `frontend/src/paginas/Productos.tsx`, `frontend/src/paginas/Modelo.tsx`, `frontend/src/componentes/SubirFoto.tsx`, `frontend/src/paginas/Productos.test.tsx`
- Modify: `frontend/src/componentes/Formulario.tsx` (agrega `Selector` y `BotonSecundario` si hacen falta)

**Interfaces:**
- Consumes: la API de las Tareas 3 y 5, más `formato.ts`, `Estado` y `api.ts` (Tarea 6).
- Produces:
  - **Productos**: buscador con etiqueta visible «Buscar» y filtros por categoría (Todas, Crochet, Murano, Cristal, Otro). Cada modelo sale en una tarjeta con miniatura (o la inicial si no hay foto), nombre, precio en pesos, unidades y `Estado`. Arriba va el botón «Agregar modelo», que abre un formulario en la misma pantalla con Nombre, Categoría, Precio de venta, Horas de tejido y Foto. Al guardar se va a `/productos/:id`. Sin modelos aparece «Todavía no hay productos.» con el botón «Agregar el primer modelo». Una búsqueda sin resultados muestra «No hay productos que coincidan con “{texto}”.» y el botón «Borrar búsqueda».
  - **Modelo**: datos editables del modelo y una lista de variantes con existencia y estado. Cada variante tiene las acciones «Sumar a vitrina», «Registrar merma» y «Contar»; cada una abre un campo de cantidad con su botón. «Agregar variante» pide Color, Código (opcional), Stock mínimo, Pieza única y Foto. «Archivar modelo» se confirma en la misma pantalla con el texto «¿Archivar {nombre}? Sus ventas y movimientos se conservan.» y los botones «Archivar» y «Cancelar». El historial de cada variante se abre en la misma tarjeta, con fecha, tipo en palabras («Ingreso a vitrina», «Merma», «Ajuste por conteo») y cantidad con signo.
  - **SubirFoto** (`alSubir(foto: string)`): `<input type="file" accept="image/*">` con etiqueta «Foto». Dibuja la imagen en un canvas con lado mayor 1600 y la exporta como JPEG con calidad 0,85 antes de subirla, así Safari en la Mac también convierte HEIC. Si el navegador no puede leer la imagen, muestra «No se pudo leer esa foto. Prueba con otra o expórtala como JPEG.». Mientras sube, el botón dice «Subiendo foto…».
  - Los campos numéricos usan `type="text" inputMode="decimal"` y `leerNumero`. Si el valor no es válido: «Escribe un número, por ejemplo 12,5.».

- [ ] **Paso 1: Escribir las pruebas que fallan** (con `simularApi`)

```tsx
test("lista vacía invita a agregar el primer modelo", ...)
test("crear modelo envía los datos y abre su ficha", ...)       // cuerpo POST con precio_venta 125000 escrito "125.000"
test("sumar a vitrina con coma decimal envía el número", ...)    // "2" → cantidad 2; en insumos se prueba "12,5"
test("merma mayor que la existencia muestra el mensaje del servidor", ...)  // 422 "Solo hay 1."
test("archivar pide confirmación antes de borrar", ...)          // sin DELETE hasta pulsar "Archivar"
test("foto que no se puede leer muestra el error", ...)          // createImageBitmap rechaza
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Paso 3: Implementar.** Se lee la imagen con `createImageBitmap(archivo)` y, si falla, con `new Image()` sobre `URL.createObjectURL`. Las pruebas simulan `createImageBitmap` y `HTMLCanvasElement.prototype.toBlob`.

- [ ] **Paso 4: Correr pruebas, lint y build**

Run: `npm test && npx oxlint && npm run build`
Expected: todo pasa.

- [ ] **Paso 5: Commit** `git commit -m "Pantallas de productos: catálogo con fotos, ficha del modelo, variantes y movimientos"`

---

### Tarea 8: Pantallas de insumos y versión 0.2.0

**Files:**
- Create: `frontend/src/paginas/Insumos.tsx`, `frontend/src/paginas/Insumo.tsx`, `frontend/src/paginas/Insumos.test.tsx`
- Modify: `frontend/src/paginas/Inicio.tsx` (resumen de lo que está por agotarse), `backend/app/version.py` (`0.2.0`), `frontend/package.json` (`0.2.0`)

**Interfaces:**
- Consumes: la API de la Tarea 4 y todo lo de la Tarea 6.
- Produces:
  - **Insumos**: lista con buscador, filtro por tipo, existencia con su unidad («800 metros»), precio vigente por unidad y `Estado`. «Agregar insumo» pide Nombre, Tipo, Unidad, ¿Lo compras por paquete o cono? (si se marca, pide Unidad de compra y Cuántas {unidad} trae), Stock mínimo, Proveedor y Precio por {unidad}. Los estados vacíos siguen el mismo patrón que Productos.
  - **Insumo**: datos editables. «Registrar entrada» pide cantidad, un selector entre {unidad} y {unidad_compra} (solo si hay conversión) y el precio pagado por esa unidad (opcional). También están «Registrar merma», «Contar», el historial de precios (fecha, precio y «Editado» o «Compra») y el historial de movimientos. «Archivar» funciona igual que en los modelos.
  - **Inicio**: debajo del saludo, una tarjeta por cada lista que tenga elementos en `por_agotarse` o `bajo_minimo`: «{n} productos por revisar» o «{n} insumos por revisar», con enlace a esa lista. Sin pendientes: «Todo el inventario está en orden.».

- [ ] **Paso 1: Escribir las pruebas que fallan**

```tsx
test("entrada en conos envía en_unidad_compra", ...)            // cuerpo {cantidad: 2, en_unidad_compra: true, precio_unitario: 12000}
test("cantidad con coma decimal", ...)                          // "12,5" → 12.5
test("conversión a medias muestra el error del servidor", ...)
test("historial de precios muestra el origen", ...)
test("inicio cuenta lo que está por agotarse", ...)             // 2 insumos bajo mínimo → "2 insumos por revisar"
```

- [ ] **Paso 2: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL.

- [ ] **Paso 3: Implementar y subir la versión a 0.2.0**

- [ ] **Paso 4: Verificación completa**

Run: `cd backend && uv run pytest -q && uv run ruff check . && cd ../frontend && npm test && npx oxlint && npm run build`
Expected: todo pasa.
Además, prueba manual en el navegador con `uv run python -m app` y `WEB_DIR=../frontend/dist`, a 375 px y a 1280 px. Hay que crear un modelo con dos variantes y foto, un insumo con conos, una entrada en conos, una merma y un conteo, y confirmar que en Inicio aparece lo que está por agotarse.

- [ ] **Paso 5: Commit** `git commit -m "Pantallas de insumos, resumen de inventario en Inicio y versión 0.2.0"`

---

## Después de las tareas

- Revisión final de toda la rama, PR de `inventario` a `base-ejecutable`, o a `main` si el #54 ya se unió, y etiqueta `v0.2.0` cuando se una.
- Siguiente plan: venta rápida con comprobante en PDF. Usará `registrar_movimiento(tipo="venta")` y la regla de caché del PDF.
