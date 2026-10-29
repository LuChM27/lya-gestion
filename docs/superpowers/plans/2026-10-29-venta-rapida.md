# Venta rápida con comprobante en PDF — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ella registre una venta de vitrina en segundos desde el celular o la Mac: toca los productos, elige dónde entró el dinero y guarda. La venta descuenta el stock, suma el ingreso a la cuenta y deja un comprobante en PDF que puede abrir, imprimir o mandar por WhatsApp. También ve las ventas de cada día con su total y puede anular una venta mal registrada.

**Architecture:** Un paquete nuevo `app/ventas/` con los modelos que la spec pone alrededor de una venta: Cuenta, Categoría, Transacción, Cliente, Pedido, PedidoItem y Pago, más la migración `0003`. Una venta rápida es un `Pedido` de tipo `inmediata`. Se guarda en una sola transacción de base de datos: pedido, ítems, un movimiento `venta` por ítem (con `registrar_movimiento`, que ya es seguro entre dispositivos), el pago y su transacción de ingreso. Si algo falla, no queda nada a medias. El comprobante se arma en memoria con ReportLab en `/api/pedidos/{id}/comprobante.pdf?v=<actualizado>`. En la interfaz entran dos pantallas, Vender y Ventas (lista del día y detalle), y un resumen en Inicio.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic, ReportLab (nuevo), tzdata (nuevo), pypdf (solo en pruebas); React 19, react-router-dom 7, Tailwind v4, Vitest.

**Spec:** `docs/arquitectura.md`: secciones «Módulos funcionales» (filas Ventas y pedidos, Clientes y Contabilidad), «Reglas de negocio», «Arquitectura técnica» (fila Comprobantes y reglas de caché del navegador), «Modelo de datos» (Pedido, PedidoItem, Pago, Cuenta, Transacción, Categoría y Cliente) y «Riesgos, fases y verificación».

**Rama:** `ventas`, creada desde `main` con el inventario (0.2.0) ya unido.

## Global Constraints

- Todo lo de los planes anteriores sigue vigente: Python 3.13, ruedas para macOS 12 x86_64 y arm64, `safari17`, sin CDN, `/api/*` con `no-store`, textos en español de Colombia, botones que empiezan por verbo, sin «OK» ni «Enviar», pantallas desde 360 px y botones de al menos 44 px.
- Montos en pesos colombianos sin decimales: `Integer` en la base y `$ 125.000` en pantalla y en el PDF. Fechas DD/MM/AAAA, zona `America/Bogota`. «Hoy» y los límites de cada día se calculan en hora de Bogotá; la base guarda UTC sin zona, como en el inventario.
- Canales de venta, según la spec: `instagram`, `tiktok`, `whatsapp`, `feria`, `presencial`. En pantalla se muestran como Instagram, TikTok, WhatsApp, Feria y Presencial.
- Tipos de pedido: `inmediata`, `encargo`, `arreglo`. Este plan solo crea `inmediata`. Estados según la spec: `cotizado`, `apartado`, `en_proceso`, `listo`, `pagado`, `enviado`, `entregado`, `cancelado`. Una venta rápida nace `entregado`; al anularla pasa a `cancelado`.
- Vender un producto de vitrina descuenta su stock al guardar (movimiento `venta`, cantidad negativa). No se vende más de lo que hay: 422 «Solo hay N de {modelo} {color}.».
- Cada pago crea una `Transaccion` de tipo `ingreso`, categoría «Ventas», en la cuenta elegida, con descripción «Venta N.º 0012». No se fía: la venta rápida se paga completa, en una sola cuenta.
- El costo unitario se congela en `PedidoItem.costo_unitario` al vender. Mientras no haya recetas (fase 2), costo = horas de tejido del modelo × 10.000, redondeado a peso.
- Comprobante: ReportLab, generado en memoria en cada petición, nunca guardado como archivo. Dirección `/api/pedidos/{id}/comprobante.pdf?v=<actualizado>`, con `Cache-Control: no-store`, `Content-Type: application/pdf` y `Content-Disposition: inline; filename="comprobante-0012.pdf"`. Colores del logo: rosa intenso `#D9487E` para el encabezado y dorado `#C9A227` para el total.
- El número visible de una venta es el id del pedido con 4 cifras: «N.º 0012».
- Versión al terminar: `0.3.0`.

## Review Focus

- **Dos dispositivos venden la última unidad casi al mismo tiempo, o un ítem del carrito ya no tiene stock.** Uno guarda y el otro recibe «Solo hay 0 de …». No queda pedido, pago ni transacción a medias. Prueba en la Tarea 2 (`test_venta_sin_stock_no_deja_nada`).
- **Safari muestra un comprobante viejo después de anular la venta.** La dirección `?v=` cambia, el PDF dice «ANULADA» y la respuesta trae `no-store`. Prueba en la Tarea 4 (`test_comprobante_cambia_al_anular`).
- **Venta registrada a las 8 p. m. en Bogotá, que en UTC ya es el día siguiente.** Sale en la lista del día de Bogotá, no en la de mañana. Prueba en la Tarea 3 (`test_venta_de_la_noche_cuenta_en_su_dia`).
- **Descuento mayor que el subtotal, o descuento igual al subtotal (regalo).** El primero da 422 «El descuento no puede ser mayor que el subtotal.». El segundo guarda la venta con total 0 y sin pago ni transacción. Prueba en la Tarea 2.
- **Variante archivada, cuenta inactiva o inexistente, o la misma variante dos veces en el carrito.** Archivada: 422 «{modelo} {color} está archivado.». Cuenta: 422 «Elige la cuenta donde entró el dinero.». Repetida: se suman las cantidades antes de revisar el stock. Pruebas en la Tarea 2.

---

## Estructura de archivos

```
backend/app/ventas/
  __init__.py
  modelos.py       Cuenta, Categoria, Transaccion, Cliente, Pedido, PedidoItem, Pago
  esquemas.py      VentaEntrada, VentaSalida, DiaVentas, CatalogoItem, CuentaSalida
  ventas.py        registrar_venta(), anular_venta(), router /api/ventas y /api/cuentas
  comprobante.py   comprobante_pdf(), router /api/pedidos/{id}/comprobante.pdf
backend/app/hora.py            BOGOTA, limites_del_dia(), hoy_bogota()
backend/migraciones/versions/0003_ventas.py
backend/tests/test_ventas.py, test_comprobante.py
frontend/src/
  ventas.ts                    tipos, CANALES, recordar()/recordado()
  componentes/Confirmar.tsx    confirmación en la misma pantalla (Archivar pasa a usarla)
  paginas/Vender.tsx, Ventas.tsx, Venta.tsx (con sus *.test.tsx)
```

---

### Tarea 1: Modelos de venta, migración y datos iniciales

**Files:**
- Create: `backend/app/ventas/__init__.py`, `backend/app/ventas/modelos.py`, `backend/migraciones/versions/0003_ventas.py`
- Modify: `backend/migraciones/env.py` (importar `app.ventas.modelos`), `backend/app/inventario/modelos.py` (`MovimientoInventario.pedido_id`), `backend/app/inventario/existencias.py` (`registrar_movimiento(..., pedido_id=None)`)
- Test: `backend/tests/test_db.py`, `backend/tests/test_existencias.py`

**Interfaces:**
- Consumes: `Base`, `MovimientoInventario`, `registrar_movimiento`.
- Produces (todas con `id` entero; montos `Integer`; fechas `DateTime` UTC sin zona):
  - `Cuenta`: `nombre` String(60) único, `saldo_inicial` int = 0, `activa` bool = True.
  - `Categoria`: `nombre` String(60) único, `tipo` String(10) (`ingreso`|`gasto`).
  - `Transaccion`: `fecha` (server_default now), `tipo` String(15), `monto` int, `descripcion` String(200), `cuenta_id` FK, `categoria_id` FK nullable, `pago_id` FK nullable con índice.
  - `Cliente`: `nombre` String(120), `whatsapp`, `direccion`, `ciudad`, `instagram`, `correo`, `cedula`, `notas`, todos nullable; `es_mostrador` bool = False; `creado`.
  - `Pedido`: `fecha` DateTime, `canal` String(20), `tipo` String(20), `estado` String(20), `cliente_id` FK, `descuento` int = 0, `total` int, `nota` String(200) nullable, `actualizado` DateTime con microsegundos, puesto desde Python (`datetime.now(UTC)` sin zona) al crear y en cada cambio. Índice en `fecha`.
  - `PedidoItem`: `pedido_id` FK (CASCADE, índice), `variante_id` FK, `cantidad` int, `precio_unitario` int, `costo_unitario` int nullable.
  - `Pago`: `pedido_id` FK (índice), `cuenta_id` FK, `fecha` (server_default now), `monto` int.
  - `MovimientoInventario.pedido_id` FK nullable a `pedido.id`, con índice. Con `op.batch_alter_table`, porque SQLite no agrega llaves foráneas con ALTER.
  - `registrar_movimiento(..., pedido_id: int | None = None)` lo guarda en el movimiento.
  - Datos iniciales de la migración: cuentas Efectivo, Nequi y Daviplata con saldo 0; categoría «Ventas» (`ingreso`); cliente «Cliente de mostrador» con `es_mostrador = true`.

- [ ] **Step 1: Write the failing tests**

En `test_db.py`, `test_migracion_crea_tablas_de_ventas`: tras `migrar`, el inspector ve `cuenta`, `categoria`, `transaccion`, `cliente`, `pedido`, `pedido_item` y `pago`, y `movimiento_inventario` tiene la columna `pedido_id`. `test_datos_iniciales_de_ventas`: los nombres de las cuentas son `["Daviplata", "Efectivo", "Nequi"]` (ordenados), existe la categoría «Ventas» de tipo `ingreso` y hay exactamente un cliente con `es_mostrador`. `test_migrar_dos_veces_no_duplica`: migrar dos veces deja 3 cuentas.

En `test_existencias.py`, `test_movimiento_guarda_el_pedido`: con un `Pedido` creado a mano, `registrar_movimiento(..., pedido_id=p.id)` devuelve un movimiento con ese `pedido_id`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && uv run pytest tests/test_db.py tests/test_existencias.py -q`
Expected: FAIL, porque las tablas y `pedido_id` no existen.

- [ ] **Step 3: Implement the models, migration 0003 and the `pedido_id` parameter**

La migración inserta los datos iniciales con `op.bulk_insert`. Su `downgrade` borra las tablas en orden inverso y quita la columna con `batch_alter_table`.

- [ ] **Step 4: Run the whole backend suite**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Modelos de ventas, cuentas y clientes con sus datos iniciales"
```

---

### Tarea 2: Registrar una venta rápida

**Files:**
- Create: `backend/app/hora.py`, `backend/app/ventas/esquemas.py`, `backend/app/ventas/ventas.py`
- Modify: `backend/app/principal.py` (router; el mensaje `DATO_INVALIDO` también para `/api/ventas`, `/api/cuentas` y `/api/pedidos`), `backend/pyproject.toml` y `uv.lock` (`tzdata`)
- Test: `backend/tests/test_ventas.py`

**Interfaces:**
- Consumes: modelos de la Tarea 1; `registrar_movimiento`, `existencias`, `ErrorInventario` (se responde 422 con el manejador que ya existe); `FechaUTC` de `app/inventario/esquemas.py`.
- Produces:
  - `app/hora.py`: `BOGOTA = ZoneInfo("America/Bogota")`, `hoy_bogota() -> date` y `limites_del_dia(dia: date) -> tuple[datetime, datetime]`. Esta última devuelve el inicio y el fin del día en Bogotá, pasados a UTC sin zona. Se agrega `tzdata` como dependencia para no depender de la base de zonas del sistema.
  - `GET /api/cuentas` → `list[CuentaSalida]` (`id`, `nombre`), solo las activas, ordenadas por id.
  - `GET /api/ventas/catalogo` → `list[CatalogoItem]` con `variante_id`, `modelo_id`, `nombre`, `color`, `sku`, `foto` (la de la variante o, si no tiene, la del modelo), `categoria`, `precio` (int, `precio_venta` del modelo) y `existencia` (int). Solo variantes y modelos activos con existencia mayor que 0, ordenados por nombre sin tildes y luego por color.
  - `VentaEntrada`: `canal` (Literal de los 5), `cuenta_id` int, `descuento` int ≥ 0 = 0, `fecha` `date | None` = None, `nota` TextoOpcional, `items` (lista de 1 a 50 `ItemEntrada` con `variante_id` int y `cantidad` int entre 1 y 1000).
  - `registrar_venta(sesion, datos: VentaEntrada) -> Pedido` y `POST /api/ventas` → 201 `VentaSalida`.
  - `VentaSalida`: `id`, `numero` («0012»), `fecha` (FechaUTC), `canal`, `estado`, `cliente` (nombre), `cuenta` (`CuentaSalida | None`), `items` (`variante_id`, `modelo`, `color`, `cantidad`, `precio_unitario`, `subtotal`), `subtotal`, `descuento`, `total` y `comprobante`. Este último es la dirección completa: `/api/pedidos/{id}/comprobante.pdf?v={actualizado:%Y%m%d%H%M%S%f}`.
  - `venta_salida(sesion, pedido: Pedido) -> VentaSalida`, que la Tarea 3 reutiliza.

Reglas de `registrar_venta`, en este orden y dentro de la misma sesión, con un solo `commit` al final:
1. La cuenta debe existir y estar activa. Si no: «Elige la cuenta donde entró el dinero.».
2. `fecha`: `None` o el día de hoy en Bogotá → ahora. Un día anterior → 12:00 de ese día en Bogotá, pasado a UTC. Un día futuro → «La fecha no puede ser futura.».
3. Se suman las cantidades de la misma variante. La variante o su modelo archivados dan «{modelo} {color} está archivado.» y una variante inexistente da 404 «Ese producto no existe.».
4. Subtotal = Σ cantidad × `precio_venta`. Si el descuento supera el subtotal: «El descuento no puede ser mayor que el subtotal.».
5. Se crea el `Pedido` (`tipo="inmediata"`, `estado="entregado"`, cliente de mostrador, total = subtotal − descuento) y sus ítems, con el costo congelado según Global Constraints.
6. Por ítem, `registrar_movimiento(tipo="venta", cantidad=-n, variante_id, pedido_id, unidad=f"de {modelo} {color}")`. Así el mensaje sin stock queda «Solo hay 1 de Bolso balde Rosa palo.».
7. Si el total es mayor que 0, se crean el `Pago` y su `Transaccion` (`ingreso`, categoría «Ventas», descripción «Venta N.º 0012»).
Cualquier error antes del `commit` deja la sesión sin cambios: la ruta no hace commit y la sesión se cierra con rollback.

- [ ] **Step 1: Write the failing tests**

En `test_ventas.py`, con ayudantes que crean un modelo «Bolso balde» de 125.000 con 6 horas de tejido, una variante «Rosa palo» con 3 en vitrina y otra «Negro» con 1:
- `test_cuentas_iniciales`: `GET /api/cuentas` da Efectivo, Nequi y Daviplata.
- `test_catalogo_solo_lo_que_hay_en_vitrina`: tras archivar «Negro», el catálogo trae solo «Rosa palo» con `existencia == 3` y `precio == 125000`.
- `test_venta_descuenta_stock_y_suma_a_la_cuenta`: vender 2 «Rosa palo» con descuento 10.000 en Nequi da 201 con `total == 240000`, `numero` de 4 cifras, `estado == "entregado"` y `cliente == "Cliente de mostrador"`. La existencia de la variante queda en 1, hay una `Transaccion` `ingreso` de 240.000 en Nequi con descripción `f"Venta N.º {numero}"` y el `PedidoItem` tiene `costo_unitario == 60000`.
- `test_venta_sin_stock_no_deja_nada`: un carrito con 1 «Rosa palo» y 2 «Negro» da 422 «Solo hay 1 de Bolso balde Negro.». Después no hay pedidos, pagos ni transacciones, y «Rosa palo» sigue en 3.
- `test_misma_variante_dos_veces_se_suma`: dos ítems de 2 «Rosa palo» dan 422 «Solo hay 3 de Bolso balde Rosa palo.».
- `test_descuento_mayor_que_subtotal_da_422` y `test_regalo_sin_pago`: con descuento igual al subtotal, la respuesta es 201 con `total == 0`, `cuenta is None` y ninguna transacción.
- `test_variante_archivada_da_422`, `test_cuenta_inactiva_da_422` y `test_fecha_futura_da_422`, cada uno con su mensaje.
- `test_venta_de_ayer`: con `fecha` = ayer en Bogotá, la fecha guardada es ayer a las 17:00 UTC.
- `test_canal_invalido_da_mensaje_en_espanol`: con `canal: "radio"`, la respuesta es 422 con `DATO_INVALIDO`.
- `test_sin_sesion_responde_401`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && uv run pytest tests/test_ventas.py -q`
Expected: FAIL con 404 en las rutas.

- [ ] **Step 3: Implement `hora.py`, the schemas, `registrar_venta` and the routes**

- [ ] **Step 4: Run the whole backend suite and lint**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Venta rápida: descuenta vitrina, suma a la cuenta y congela el costo"
```

---

### Tarea 3: Ventas del día, detalle y anulación

**Files:**
- Modify: `backend/app/ventas/ventas.py`, `backend/app/ventas/esquemas.py`
- Test: `backend/tests/test_ventas.py`

**Interfaces:**
- Consumes: `venta_salida`, `limites_del_dia`, `hoy_bogota`, `registrar_movimiento`.
- Produces:
  - `GET /api/ventas?dia=AAAA-MM-DD` (por defecto, hoy en Bogotá) → `DiaVentas`: `dia`, `ventas` (las `VentaSalida` de ese día, de la más reciente a la más vieja, anuladas incluidas), `total` (suma de las no anuladas) y `cantidad` (número de ventas no anuladas).
  - `GET /api/ventas/{id}` → `VentaSalida`; 404 «Esa venta no existe.». Lo mismo si el pedido no es de tipo `inmediata`.
  - `anular_venta(sesion, pedido: Pedido) -> None` y `POST /api/ventas/{id}/anular` → `VentaSalida`. Pasa el estado a `cancelado` y renueva `actualizado`. Por cada ítem registra un movimiento `devolucion` (+cantidad, `pedido_id`, nota «Venta N.º 0012 anulada»). Borra la `Transaccion` y el `Pago`, porque anular corrige un error de registro y no es una devolución de dinero. Si la venta ya estaba anulada: 409 «Esta venta ya está anulada.».

- [ ] **Step 1: Write the failing tests**

- `test_ventas_del_dia_con_total`: dos ventas hoy y una anulada dan `cantidad == 2`, un `total` igual a la suma de las dos y `len(ventas) == 3`, con la más reciente primero.
- `test_venta_de_la_noche_cuenta_en_su_dia`: se pone a mano, con una `Session` sobre `config_tmp`, `fecha = datetime(2026, 10, 30, 1, 0)` (UTC) en una venta. Entonces `GET /api/ventas?dia=2026-10-29` la incluye y `?dia=2026-10-30` no.
- `test_anular_devuelve_stock_y_quita_el_ingreso`: tras anular, la variante recupera su existencia, no quedan transacciones, `estado == "cancelado"` y el campo `comprobante` cambió.
- `test_anular_dos_veces_da_409`.
- `test_venta_inexistente_da_404`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && uv run pytest tests/test_ventas.py -q`
Expected: las 5 nuevas fallan.

- [ ] **Step 3: Implement the list, detail and cancellation routes**

- [ ] **Step 4: Run the whole backend suite and lint**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Ventas del día con total, detalle y anulación de una venta"
```

---

### Tarea 4: Comprobante en PDF

**Files:**
- Create: `backend/app/ventas/comprobante.py`
- Modify: `backend/app/principal.py`, `backend/pyproject.toml` y `uv.lock` (`reportlab` en dependencias; `pypdf` en el grupo `dev`)
- Test: `backend/tests/test_comprobante.py`

**Interfaces:**
- Consumes: `Pedido`, `venta_salida`, `pesos` (la versión en Python: `pesos(n: int) -> str`, «$ 125.000», que se crea en `comprobante.py`).
- Produces: `comprobante_pdf(venta: VentaSalida) -> bytes` y `GET /api/pedidos/{id}/comprobante.pdf`, que exige sesión. El parámetro `v` se ignora en el servidor: solo cambia la dirección.

Contenido del PDF, tamaño carta, fuente Helvetica (tiene tildes y ñ, así que no hace falta incrustar Nunito), en este orden:
- Encabezado rosa `#D9487E` con «L&A Tejidos» en blanco.
- «Comprobante de venta N.º 0012» y «Fecha: 29/10/2026», en hora de Bogotá.
- «Cliente: Cliente de mostrador» y «Canal: Instagram».
- Tabla con las columnas Producto, Cant., Precio y Subtotal. Cada fila dice «Bolso balde · Rosa palo».
- «Subtotal», «Descuento» (solo si es mayor que 0) y «Total», este último en dorado `#C9A227`.
- «Pagado con Nequi», o nada si el total es 0.
- Si la venta está anulada, «ANULADA» grande en rojo `#B3261E`.
- Pie: «Gracias por tu compra.» y «Este comprobante no es una factura.».

- [ ] **Step 1: Write the failing tests**

En `test_comprobante.py`, que reutiliza los ayudantes de `test_ventas.py`:
- `test_comprobante_trae_los_datos_de_la_venta`: el comprobante de una venta con descuento responde 200 con `content-type: application/pdf`, `cache-control: no-store`, `content-disposition` con `comprobante-{numero}.pdf` y un cuerpo que empieza por `%PDF`. El texto que extrae `pypdf` contiene `f"N.º {numero}"`, «Bolso balde · Rosa palo», «$ 240.000», «Descuento», «Pagado con Nequi» y «Este comprobante no es una factura.».
- `test_comprobante_cambia_al_anular`: se pide el PDF por la dirección `comprobante` de la venta, se anula y se pide por la nueva dirección. Las direcciones son distintas, los cuerpos también y el segundo texto contiene «ANULADA».
- `test_comprobante_exige_sesion` y `test_comprobante_inexistente_da_404`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && uv run pytest tests/test_comprobante.py -q`
Expected: FAIL con 404.

- [ ] **Step 3: Add the dependencies and check their Mac wheels**

`uv add reportlab` y `uv add --dev pypdf`. Luego se revisan las ruedas de macOS 12 con el mismo armado que se usó para Pillow en el plan de inventario: `uv run --project backend --with pillow python empaquetado/armar_paquete.py --plataforma x86_64-apple-darwin --version 0.3.0`, y lo mismo con `aarch64-apple-darwin`.
Expected: los dos paquetes se arman sin ruedas rechazadas por `revisar_ruedas`. Si alguna se rechaza, se fija una versión de ReportLab o de `charset-normalizer` que sí tenga rueda y se deja un comentario en `pyproject.toml`, como ya se hizo con `argon2-cffi-bindings`.

- [ ] **Step 4: Implement `comprobante_pdf` and the route**

- [ ] **Step 5: Run the whole backend suite and lint**

Run: `cd backend && uv run pytest -q && uv run ruff check . && uv run ruff format --check .`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Comprobante de venta en PDF con ReportLab, sin caché"
```

---

### Tarea 5: Pantalla Vender

**Files:**
- Create: `frontend/src/ventas.ts`, `frontend/src/paginas/Vender.tsx`, `frontend/src/paginas/Vender.test.tsx`
- Modify: `frontend/src/App.tsx` (ruta `vender`), `frontend/src/componentes/Marco.tsx` (sección «Vender»)

**Interfaces:**
- Consumes: `GET /api/ventas/catalogo`, `GET /api/cuentas`, `POST /api/ventas`, `pedir`/`enviar`, `pesos`, `leerNumero`, `miniatura`, `simularApi`.
- Produces:
  - `ventas.ts`: los tipos `CatalogoItem`, `Cuenta`, `Venta` y `DiaVentas`, que reflejan las salidas de las Tareas 2 y 3, y `CANALES: [valor, texto][]` en el orden Presencial, Feria, Instagram, WhatsApp, TikTok.
  - También `recordar(clave: string, valor: string): void` y `recordado(clave: string): string | null`, sobre `localStorage` con try/catch. Si falla, el valor no se recuerda y nada más se rompe.
  - `/vender` y `/ventas/:id` (la Tarea 6 crea la segunda; aquí la navegación ya apunta a ella).

Pantalla, de arriba abajo:
- Un campo «Buscar», que filtra en el navegador por nombre, color y código sin tildes.
- Una cuadrícula de tarjetas-botón con foto, nombre, color, precio y «{n} en vitrina». Tocar una tarjeta la agrega al carrito con 1, y tocarla de nuevo suma 1. Si ya están todas las unidades, sale «Solo hay {n} en vitrina.» y no suma.
- El carrito: cada ítem con «Quitar uno» y «Agregar uno» (botones de 44 px con texto accesible) y su subtotal.
- Debajo, el selector de canal (botones de una opción, como el filtro de categoría de Productos), el de cuenta (igual), «Descuento (opcional)», «Fecha» (`type="date"`, hoy por defecto) y el botón «Guardar venta» con el total.
- El canal y la cuenta empiezan en el último que se usó en ese dispositivo (claves `venta.canal` y `venta.cuenta`). Si no hay uno guardado, empiezan en Presencial y en la primera cuenta. Así, en el caso común la venta lleva tres toques: producto, «Guardar venta» y listo.
- Al guardar se va a `/ventas/{id}` con el estado de navegación `{ guardada: true }`. Los errores del servidor salen en el formulario, con `role="alert"`.
- Si el catálogo está vacío: «No hay productos en vitrina.» y un enlace «Ir a productos».

- [ ] **Step 1: Write the failing tests**

En `Vender.test.tsx`, con `simularApi` y un catálogo con «Bolso balde» Rosa palo (3, $ 125.000) y Negro (1):
- `test("tocar un producto lo agrega y Guardar envía la venta")`: tras tocar «Rosa palo» dos veces y luego «Guardar venta», el cuerpo enviado es igual a `{ canal: "presencial", cuenta_id: 1, descuento: 0, fecha: null, nota: null, items: [{ variante_id: 3, cantidad: 2 }] }` y aparece la ruta `/ventas/12`.
- `test("no suma más de lo que hay en vitrina")`: tocar «Negro» dos veces muestra «Solo hay 1 en vitrina.» y el carrito sigue con 1.
- `test("recuerda canal y cuenta del último uso")`: después de una venta con Feria y Nequi, al volver a montar la pantalla esos botones aparecen con `aria-pressed="true"`.
- `test("descuento mayor que el subtotal no se envía")`: muestra «El descuento no puede ser mayor que el subtotal.» y no hay POST.
- `test("error del servidor se muestra")`: con 422 «Solo hay 0 de Bolso balde Negro.», ese texto aparece.
- `test("sin productos en vitrina")`.
- `test("fecha de otro día se envía")`: con la fecha cambiada a 2026-10-28, se envía `fecha: "2026-10-28"`. Si es hoy, se envía `null`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/paginas/Vender.test.tsx`
Expected: FAIL, porque `Vender` no existe.

- [ ] **Step 3: Implement `ventas.ts`, `Vender.tsx`, the route and the navigation section**

La navegación queda en este orden: Inicio, Vender, Ventas, Productos, Insumos. En el celular las etiquetas van en `text-sm` y con `px-1`, para que las cinco quepan en 360 px.

- [ ] **Step 4: Run the whole frontend suite, types, lint and build**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build`
Expected: todo pasa.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "Pantalla Vender: catálogo de vitrina, carrito, canal y cuenta recordados"
```

---

### Tarea 6: Ventas del día, detalle con comprobante y anulación, resumen en Inicio

**Files:**
- Create: `frontend/src/componentes/Confirmar.tsx`, `frontend/src/paginas/Ventas.tsx`, `frontend/src/paginas/Venta.tsx`, `frontend/src/paginas/Ventas.test.tsx`
- Modify: `frontend/src/componentes/Archivar.tsx` (usa `Confirmar`), `frontend/src/App.tsx` (`ventas` y `ventas/:id`), `frontend/src/paginas/Inicio.tsx`, `frontend/package.json` y `package-lock.json` (0.3.0), `backend/app/version.py` (`0.3.0`)

**Interfaces:**
- Consumes: `GET /api/ventas?dia=`, `GET /api/ventas/{id}`, `POST /api/ventas/{id}/anular`, los tipos de `ventas.ts`, `fecha`, `pesos`.
- Produces: `Confirmar({ boton, pregunta, accion, alConfirmar })`, la confirmación en la misma tarjeta que ya usa Archivar, con su botón de peligro y «Cancelar». `Archivar` queda como un envoltorio con su texto actual, y sus pruebas siguen pasando sin cambios.

Pantallas:
- **Ventas (`/ventas`):** título «Ventas», botón «Nueva venta» (a `/vender`) y un campo «Día» (`type="date"`). Luego una línea «{cantidad} ventas · {total}» y la lista. Cada venta muestra hora, productos resumidos («Bolso balde · Rosa palo ×2»), canal y total, y enlaza a su detalle. Las anuladas van tachadas, con la etiqueta «Anulada». Si el día no tiene ventas: «No hay ventas este día.».
- **Venta (`/ventas/:id`):** si se llegó desde Vender (estado de navegación `{ guardada: true }`), arriba sale «Venta guardada» con `role="status"`. Debajo van el número, la fecha, el canal, la cuenta, los ítems y los totales. Luego el enlace «Ver comprobante» (`href` = campo `comprobante`, `target="_blank"`), que en el iPhone abre el PDF y deja compartirlo por WhatsApp, y el botón «Nueva venta». Al final, `Confirmar` con el botón «Anular venta» y la pregunta «¿Anular la venta N.º 0012? Las unidades vuelven a la vitrina y se quita el ingreso de Nequi.». Las ventas anuladas no muestran «Anular venta».
- **Inicio:** una tarjeta «Ventas de hoy: {total} ({cantidad})» que enlaza a `/ventas`, encima del resumen de inventario.

- [ ] **Step 1: Write the failing tests**

En `Ventas.test.tsx`:
- `test("lista del día con total y anuladas tachadas")`: muestra «2 ventas · $ 365.000» y la etiqueta «Anulada».
- `test("cambiar el día pide ese día")`: con la fecha cambiada a 2026-10-28, se hace `GET /api/ventas?dia=2026-10-28`.
- `test("detalle muestra el comprobante con su dirección")`: el enlace «Ver comprobante» tiene `href` igual al campo `comprobante`.
- `test("anular pide confirmación y actualiza")`: el primer toque muestra la pregunta. Al confirmar se hace `POST .../anular` y luego aparece «Anulada».
- `test("venta recién guardada lo dice")`.
- `test("inicio muestra las ventas de hoy")`: con `GET /api/ventas` simulado, Inicio muestra «Ventas de hoy: $ 240.000 (1)».

Las pruebas de Productos e Insumos que tocan Archivar o Inicio deben seguir pasando. Si Inicio ahora pide `/api/ventas`, sus simulaciones en `Insumos.test.tsx` se amplían con esa ruta.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/paginas/Ventas.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `Confirmar`, Ventas, Venta, the Inicio card and version 0.3.0**

- [ ] **Step 4: Run every check**

Run: `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build` y `cd backend && uv run pytest -q && uv run ruff check .`
Expected: todo pasa.

- [ ] **Step 5: Manual check in the browser**

Se arranca el backend con datos de prueba y `npm run dev`. Se vende «Rosa palo» desde Vender a 375 px de ancho, se abre el comprobante, se anula la venta y se abre el comprobante otra vez.
Expected: la venta se guarda con 3 toques, sin desplazamiento horizontal y con las cinco secciones de navegación visibles. El primer PDF muestra la venta y el segundo dice «ANULADA».

- [ ] **Step 6: Commit**

```bash
git add frontend backend/app/version.py
git commit -m "Ventas del día, detalle con comprobante y anulación, resumen en Inicio y versión 0.3.0"
```
