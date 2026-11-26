# Mis cuentas y compras — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ella sepa cuánto entra, cuánto sale y cuánto queda en cada cuenta: saldos, gastos, otros ingresos, transferencias, retiros personales, gastos fijos que no se olvidan, un resumen de cada mes y compras de insumos con pago opcional que se puede registrar después.

**Architecture:** Paquete nuevo `app/cuentas/` (cuentas, categorías, movimientos de dinero, gastos fijos, resumen del mes) y `app/compras/` (compras de insumos con varios ítems, pago y anulación), sobre `Cuenta`, `Categoria` y `Transaccion` que ya existen en `app/ventas/modelos.py`, más la migración `0007`. El saldo se calcula siempre sumando transacciones; no se guarda. En la interfaz entran la pantalla Mis cuentas, Registrar gasto a pantalla completa en el celular, y las pantallas de compras.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic; React 19, react-router-dom 7, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-clientes-y-cuentas-design.md`, sección «Plan 2 · Mis cuentas y compras»; `docs/arquitectura.md`, fila Contabilidad y «Reglas de negocio» (cada pago crea un ingreso, cada compra un egreso, una transferencia no es ingreso, los retiros tienen su categoría).

**Rama:** `clientes-cuentas`, sobre el plan 1 (Clientes, 0.4.0) ya hecho.

## Global Constraints

- Todo lo de los planes anteriores sigue vigente: Python 3.13, ruedas macOS 12, `safari17`, sin CDN, `/api/*` con `no-store`, español de Colombia con tuteo, botones que empiezan por verbo, 360 px sin desplazamiento horizontal, botones de 44 px o más.
- Montos en pesos enteros (`Integer`), `$ 125.000` en pantalla; fechas DD/MM/AAAA, «hoy» y los límites de día y de mes en hora de Bogotá; la base guarda UTC sin zona.
- Interfaz: carga la skill `diseno-lya` antes de cada tarea de interfaz. Fuentes: `docs/mockups/fuentes/cuentas-mac.html`, `compra-mac.html` y `cuentas-celular.html` (tercera pantalla: Registrar gasto; segunda: «Más»).
- Saldo de una cuenta = saldo inicial + ingresos − egresos − transferencias que salen + transferencias que entran. Puede quedar negativo: se muestra en rojo y no impide guardar.
- Categorías sembradas: gasto (Insumos, Envíos, Publicidad, Stand de feria, Empaques, Transporte, Servicios, Otros gastos); retiro (Retiro personal); ingreso (Ventas, que ya existe, y Otros ingresos). «Ventas», «Insumos» y «Retiro personal» no se archivan: 409 «La app usa esta categoría: no se puede archivar.».
- Lo que viene de una venta (`pago_id`) o de una compra (`compra_id`) no se edita ni se borra desde Mis cuentas: 409 «Este movimiento viene de {la venta N.º 0012 | la compra N.º 0003}: cámbialo desde allá.».
- Los gastos fijos nunca se registran solos.
- Resumen del mes: entró = ingresos (ventas + otros); salió = egresos con categoría de tipo `gasto`; ganancia = entró − salió; retiros aparte; las transferencias no cuentan. Se calcula al pedirlo; no bloquea nada.
- Número visible de una compra: id con 4 cifras, «N.º 0003».
- Mensajes: monto ≤ 0 → 422 de validación; cuenta archivada o inexistente → 422 «Elige una cuenta.»; categoría de otro tipo o archivada → 422 «Elige una categoría.»; transferencia a la misma cuenta → 422 «Elige dos cuentas distintas.»; fecha futura → 422 «La fecha no puede ser futura.»; nombre de cuenta o categoría repetido → 409 «Ya tienes una cuenta llamada {nombre}.» / «Ya tienes una categoría llamada {nombre}.»; compra ya pagada → 409 «Esta compra ya está pagada.»; compra anulada al pagar o anular otra vez → 409 «Esta compra está anulada.»; compra sin ítems → 422 de validación; insumo archivado en una compra → 422 «{insumo} está archivado.».
- Versión al terminar: `0.5.0`.

## Review Focus

- **Pagar una compra desde dos equipos a la vez, o con doble toque:** queda un solo egreso; el segundo recibe 409 «Esta compra ya está pagada.». Prueba en la Tarea 4 (`test_pagar_dos_veces`), con el cambio de `cuenta_id` hecho con un `UPDATE … WHERE cuenta_id IS NULL AND estado = 'activa'` condicional, como la anulación de ventas.
- **Gasto registrado a las 8 p. m. del 31 de un mes en Bogotá (ya es el día 1 en UTC):** cuenta en el mes de Bogotá en el resumen y en la lista de movimientos. Prueba en la Tarea 3 (`test_gasto_de_la_noche_cuenta_en_su_mes`).
- **Anular una compra cuyos insumos ya se gastaron:** el inventario puede quedar en negativo (como la producción) y la anulación igual se hace; el egreso y el precio de esa compra desaparecen; el precio vigente vuelve al anterior. Prueba en la Tarea 4 (`test_anular_compra`).
- **Archivar una cuenta que tiene saldo:** se puede; deja de salir en la venta, los gastos y las compras, pero sus movimientos siguen en la lista y en el resumen. Prueba en la Tarea 1 (`test_archivar_cuenta_con_saldo`).
- **Monto escrito «150.000» o «$ 150.000» en el celular:** se lee como 150000, no como 150. Prueba en la Tarea 6 (`lee el monto con puntos de miles`).

---

## Estructura de archivos

```
backend/
  migraciones/versions/0007_cuentas_y_compras.py
  app/ventas/modelos.py           Categoria.activa; Transaccion.cuenta_destino_id, compra_id, gasto_fijo_id, nota; GastoFijo
  app/compras/modelos.py          Compra
  app/inventario/modelos.py       MovimientoInventario.compra_id, PrecioInsumo.compra_id
  app/cuentas/__init__.py
  app/cuentas/esquemas.py
  app/cuentas/saldos.py           saldos(), MOSTRAR_ORIGEN, mes_utc()
  app/cuentas/cuentas.py          router: cuentas y categorías
  app/cuentas/movimientos.py      router: movimientos, gastos fijos, resumen
  app/compras/__init__.py
  app/compras/esquemas.py
  app/compras/compras.py          router: compras
  app/inventario/existencias.py   registrar_movimiento(compra_id=)
  app/principal.py, app/version.py
  tests/test_cuentas.py, tests/test_movimientos.py, tests/test_compras.py
frontend/src/
  dinero.ts                       tipos de cuentas, movimientos, resumen, compras; leerPesos()
  componentes/iconos.tsx          IconoCuentas, IconoTransferir
  componentes/Marco.tsx           sección Mis cuentas; pantalla completa en /cuentas/gasto
  componentes/FormularioMovimiento.tsx
  componentes/FormularioCuenta.tsx, FormularioGastoFijo.tsx
  paginas/Cuentas.tsx (+ test)    Mis cuentas
  paginas/Gasto.tsx (+ test)      Registrar gasto a pantalla completa (celular y Mac)
  paginas/Categorias.tsx
  paginas/Compras.tsx, Compra.tsx, NuevaCompra.tsx (+ tests)
  paginas/Mas.tsx, Productos.tsx, Insumos.tsx, App.tsx
```

---

### Tarea 1: Datos, cuentas con saldo y categorías

**Files:**
- Create: `backend/migraciones/versions/0007_cuentas_y_compras.py`, `backend/app/compras/__init__.py`, `backend/app/compras/modelos.py`, `backend/app/cuentas/__init__.py`, `backend/app/cuentas/esquemas.py`, `backend/app/cuentas/saldos.py`, `backend/app/cuentas/cuentas.py`, `backend/tests/test_cuentas.py`
- Modify: `backend/app/ventas/modelos.py`, `backend/app/inventario/modelos.py`, `backend/app/principal.py`

**Interfaces:**
- Produces:
  - Migración `0007` (down `0006`): `categoria.activa` (default true); siembra las categorías de Global Constraints que falten; `transaccion.cuenta_destino_id`, `compra_id`, `gasto_fijo_id` (FK, índice en `compra_id`) y `nota` String(200); tablas `gasto_fijo` (id, nombre String(80), monto Integer, categoria_id FK, cuenta_id FK nullable, activo) y `compra` (id, fecha DateTime, proveedor String(120) nullable, total Integer, cuenta_id FK nullable, estado String(10) default «activa», nota String(200) nullable, actualizado DateTime); `movimiento_inventario.compra_id` y `precio_insumo.compra_id` (FK nullable, índice).
  - `saldos(sesion, hasta: datetime | None = None) -> dict[int, int]` en `saldos.py`: saldo de cada cuenta (todas, activas o no) con las transacciones de fecha `< hasta`; sin `hasta`, todas.
  - `mes_utc(mes: str) -> tuple[datetime, datetime]` en `saldos.py`: «2026-11» → inicio y fin del mes en Bogotá pasados a UTC; 422 «Elige un mes válido.» si no es `AAAA-MM`.
  - `CuentaSaldo(id, nombre, saldo_inicial, saldo, activa)`. Rutas: `GET /api/cuentas/saldos?archivadas=false` → `list[CuentaSaldo]` por id; `POST /api/cuentas` `{nombre, saldo_inicial=0}` 201 → `CuentaSaldo`; `PUT /api/cuentas/{id}` igual; `DELETE /api/cuentas/{id}` 204 (archiva); `POST /api/cuentas/{id}/restaurar`. El `GET /api/cuentas` de ventas no cambia.
  - `CategoriaSalida(id, nombre, tipo, activa, protegida: bool)`. Rutas: `GET /api/categorias?tipo=&archivadas=false`, `POST /api/categorias` `{nombre, tipo: "ingreso"|"gasto"}` (no se crean de tipo `retiro`), `PUT /api/categorias/{id}` `{nombre}`, `DELETE` 204, `POST /{id}/restaurar`.

- [ ] **Paso 1: Pruebas que fallan** en `test_cuentas.py`:
  - `test_categorias_sembradas`: `GET /api/categorias?tipo=gasto` trae las 8 de gasto en orden de nombre sin tildes; «Retiro personal» es `retiro` y `protegida`; «Ventas», «Insumos» también protegidas.
  - `test_saldo_inicial_y_ventas`: con Nequi en saldo inicial 0, una venta de 125.000 por Nequi deja `saldo == 125000`; `PUT` con `saldo_inicial=50000` deja 175.000.
  - `test_crear_cuenta_y_repetida`: crear «Bancolombia» con 300.000 da 201 y `saldo == 300000`, y sale en `GET /api/cuentas` de la venta; crear «bancolombia» de nuevo da 409 «Ya tienes una cuenta llamada bancolombia.».
  - `test_archivar_cuenta_con_saldo`: archivar Nequi con saldo da 204; ya no sale en `GET /api/cuentas` ni en `saldos`, sí con `archivadas=true` y conserva su saldo.
  - `test_categoria_nueva_y_protegida`: crear «Clases» tipo gasto da 201; archivar «Insumos» da 409 «La app usa esta categoría: no se puede archivar.»; archivar «Clases» da 204; `POST tipo="retiro"` da 422.
  - `test_saldo_hasta_una_fecha`: `saldos(sesion, hasta)` con transacciones antes y después de `hasta` solo suma las de antes (prueba directa de la función con `Session(crear_motor(config_tmp))`).
  - `test_mes_utc`: `mes_utc("2026-11") == (datetime(2026,11,1,5), datetime(2026,12,1,5))`; `mes_utc("2026-13")` lanza `HTTPException` 422.
- [ ] **Paso 2:** `cd backend && uv run pytest tests/test_cuentas.py -q` → FAIL.
- [ ] **Paso 3: Implementar.** Nombres repetidos comparados con `sin_tildes`. Saldo en una consulta agrupada por cuenta (`CASE` por tipo, y las transferencias sumadas por `cuenta_destino_id`).
- [ ] **Paso 4:** `cd backend && uv run pytest -q && uv run ruff check .` → todo pasa.
- [ ] **Paso 5: Commit** «Cuentas con saldo calculado, categorías editables y datos de gastos fijos y compras».

### Tarea 2: Movimientos de dinero

**Files:**
- Create: `backend/app/cuentas/movimientos.py`, `backend/tests/test_movimientos.py`
- Modify: `backend/app/cuentas/esquemas.py`, `backend/app/principal.py`

**Interfaces:**
- Consumes: `saldos`, `mes_utc`; `_fecha(dia)` de `app/ventas/ventas.py` (hoy = ahora; otro día = mediodía de Bogotá; futuro = 422) — muévela a `app/hora.py` como `fecha_de_registro(dia: date | None) -> datetime`, con el mismo comportamiento y el mismo mensaje, y úsala en ventas y aquí.
- Produces:
  - `MovimientoEntrada(tipo: Literal["gasto","ingreso","retiro","transferencia"], monto: int > 0, cuenta_id: int, cuenta_destino_id: int | None = None, categoria_id: int | None = None, fecha: date | None = None, nota: TextoOpcional = None, gasto_fijo_id: int | None = None)`.
  - `MovimientoSalida(id, fecha: FechaUTC, tipo, descripcion: str, categoria: str | None, cuenta: str, cuenta_destino: str | None, monto: int, signo: Literal["+","-","="], editable: bool, origen: Origen | None)` con `Origen(tipo: Literal["venta","compra"], id: int, numero: str)`.
  - Rutas: `GET /api/movimientos?mes=AAAA-MM&cuenta_id=` (del más reciente al más viejo; con `cuenta_id`, también las transferencias que entran a esa cuenta); `POST /api/movimientos` 201; `PUT /api/movimientos/{id}`; `DELETE /api/movimientos/{id}` 204.
  - Mapeo a `Transaccion`: gasto → `egreso` con categoría de tipo gasto; retiro → `egreso` con «Retiro personal» (ignora `categoria_id`); ingreso → `ingreso` con categoría de tipo ingreso distinta de «Ventas»; transferencia → `transferencia` sin categoría. `descripcion` = nota o, si no hay, el nombre de la categoría («Pasé a {destino}» en transferencias).

- [ ] **Paso 1: Pruebas que fallan** en `test_movimientos.py`:
  - `test_registrar_gasto_baja_el_saldo`: gasto de 150.000 «Stand de feria» desde Efectivo con saldo inicial 300.000 → saldo 150.000; en la lista sale con `signo "-"`, `editable true`, `origen null`.
  - `test_ingreso_retiro_y_transferencia`: otro ingreso +50.000, retiro −40.000 (categoría «Retiro personal» aunque se mande otra), transferencia 100.000 de Efectivo a Nequi: los saldos quedan bien en las dos cuentas; la transferencia sale con `signo "="` y `cuenta_destino "Nequi"`.
  - `test_validaciones`: monto 0 → 422; cuenta archivada → «Elige una cuenta.»; gasto con categoría de ingreso → «Elige una categoría.»; ingreso con «Ventas» → «Elige una categoría.»; transferencia a la misma cuenta → «Elige dos cuentas distintas.»; fecha de mañana → «La fecha no puede ser futura.».
  - `test_editar_y_borrar_manual`: `PUT` cambia monto y categoría; `DELETE` da 204 y el saldo vuelve.
  - `test_lo_de_una_venta_no_se_toca`: la transacción de una venta sale con `editable false` y `origen {tipo: "venta", numero: "0001"}`; `PUT` y `DELETE` dan 409 «Este movimiento viene de la venta N.º 0001: cámbialo desde allá.».
  - `test_filtrar_por_mes_y_cuenta`: un gasto con `fecha` del mes pasado no sale en el mes actual; con `cuenta_id` de Nequi salen la venta y la transferencia que entra.
  - `test_gasto_de_la_noche_cuenta_en_su_mes`: una transacción insertada en la base a las 2026-11-01 01:00 UTC (31/10 8 p. m. en Bogotá) sale en `mes=2026-10` y no en `2026-11`.
- [ ] **Paso 2:** `uv run pytest tests/test_movimientos.py -q` → FAIL.
- [ ] **Paso 3: Implementar** (y mover `_fecha` a `hora.fecha_de_registro`; `test_ventas.py` debe seguir pasando).
- [ ] **Paso 4:** `uv run pytest -q && uv run ruff check .` → todo pasa.
- [ ] **Paso 5: Commit** «Gastos, otros ingresos, retiros y transferencias con su saldo; lo de ventas y compras no se toca».

### Tarea 3: Gastos fijos y resumen del mes

**Files:**
- Modify: `backend/app/cuentas/movimientos.py`, `backend/app/cuentas/esquemas.py`
- Test: `backend/tests/test_movimientos.py`

**Interfaces:**
- Produces:
  - `GastoFijoEntrada(nombre: Texto, monto: int ≥ 0, categoria_id: int, cuenta_id: int | None = None)`; `GastoFijoSalida(id, nombre, monto, categoria_id, categoria, cuenta_id, cuenta: str | None, activo, registrado_este_mes: bool)`.
  - `GET /api/gastos-fijos` (activos, por nombre, con `registrado_este_mes` según el mes en curso de Bogotá); `POST` 201; `PUT /{id}`; `DELETE /{id}` 204 (archiva).
  - Un `POST /api/movimientos` con `gasto_fijo_id` lo marca registrado ese mes (el de la fecha del movimiento).
  - `ResumenMes(mes: str, entro: int, salio: int, ganancia: int, retiros: int, por_categoria: list[{categoria: str, monto: int}], saldos_al_cierre: list[{cuenta: str, saldo: int}])`; `GET /api/cuentas/resumen?mes=AAAA-MM` (sin `mes`, el actual). `por_categoria` solo gastos, de mayor a menor. `saldos_al_cierre` usa `saldos(hasta=fin del mes)` de las cuentas activas más las archivadas con saldo distinto de 0.

- [ ] **Paso 1: Pruebas que fallan:**
  - `test_gasto_fijo_pendiente_y_registrado`: «Internet», 85.000, Servicios, Nequi: sale con `registrado_este_mes false`; tras un gasto con su `gasto_fijo_id`, `true`. No cambia ningún saldo hasta que se registra.
  - `test_gasto_fijo_registrado_el_mes_pasado_vuelve_a_faltar`: un gasto con `gasto_fijo_id` y fecha del mes pasado no lo marca este mes.
  - `test_resumen_del_mes`: venta 125.000, otro ingreso 50.000, gastos 150.000 (Stand) y 80.000 (Publicidad), retiro 40.000 y transferencia 100.000 → `entro 175000`, `salio 230000`, `ganancia -55000`, `retiros 40000`, `por_categoria [Stand 150000, Publicidad 80000]`.
  - `test_saldos_al_cierre_de_un_mes_anterior`: un gasto de este mes no cambia `saldos_al_cierre` del mes pasado.
- [ ] **Paso 2:** FAIL. **Paso 3:** implementar. **Paso 4:** `uv run pytest -q && uv run ruff check .`.
- [ ] **Paso 5: Commit** «Gastos fijos que se registran a mano y resumen del mes con saldos al cierre».

### Tarea 4: Compras de insumos con pago opcional y anulación

**Files:**
- Create: `backend/app/compras/esquemas.py`, `backend/app/compras/compras.py`, `backend/tests/test_compras.py`
- Modify: `backend/app/inventario/existencias.py` (`registrar_movimiento(..., compra_id: int | None = None)`), `backend/app/inventario/insumos.py` (`_nuevo_precio(..., compra_id=None)`), `backend/app/principal.py`

**Interfaces:**
- Consumes: `registrar_movimiento`, `_nuevo_precio`, `precio_vigente`, `CENTAVO` de insumos; `fecha_de_registro`; categoría «Insumos».
- Produces:
  - `ItemCompraEntrada(insumo_id, cantidad: CantidadPositiva, en_unidad_compra: bool = False, precio_unitario: Precio)` (precio por la unidad en que se contó).
  - `CompraEntrada(proveedor: TextoOpcional, fecha: date | None, cuenta_id: int | None, nota: TextoOpcional, items: list[ItemCompraEntrada] min 1 máx 50)`.
  - `CompraSalida(id, numero, fecha, proveedor, total, estado, cuenta: CuentaSalida | None, pagada_el: FechaUTC | None, items: list[{insumo_id, insumo, cantidad: Numero, unidad, precio_unitario: Numero, subtotal: int}])`. `cantidad`, `unidad` y `precio_unitario` en la unidad propia del insumo.
  - Rutas: `POST /api/compras` 201; `GET /api/compras?sin_pagar=false` (más reciente primero); `GET /api/compras/proveedores` → `list[str]` (los usados, sin repetir, por nombre); `GET /api/compras/{id}`; `POST /api/compras/{id}/pago` `{cuenta_id, fecha: date | None}`; `POST /api/compras/{id}/anular`.
  - Total = Σ round(cantidad × precio) por ítem, en pesos. Egreso: categoría Insumos, `compra_id`, descripción «Compra N.º 0003 · {proveedor}» (sin « · » si no hay proveedor).

- [ ] **Paso 1: Pruebas que fallan** en `test_compras.py` (insumos creados con el ayudante de `tests/test_insumos.py`):
  - `test_compra_pagada`: hilo con unidad de compra «cono» = 400 m: 2 conos a 18.000 y 20 argollas a 1.500 pagados con Nequi → 201, `total 66000`, existencia del hilo +800 m, precio vigente del hilo 45 por metro, saldo de Nequi −66.000, movimiento de Mis cuentas «Compra N.º 0001 · Hilos La 14» con `origen compra`.
  - `test_compra_sin_pagar_y_pago_despues`: sin `cuenta_id` no cambia ningún saldo y sale en `sin_pagar=true`; `POST pago` con Efectivo y fecha de ayer crea el egreso con esa fecha y la quita de `sin_pagar`.
  - `test_pagar_dos_veces`: el segundo pago da 409 «Esta compra ya está pagada.» y hay un solo egreso.
  - `test_anular_compra`: tras gastar parte del hilo con una merma, anular deja la existencia en lo que había antes de la compra menos la merma (puede ser negativa), borra el egreso y el `PrecioInsumo` de la compra (el precio vigente vuelve al anterior), `estado "anulada"`; anular otra vez y pagar después dan 409 «Esta compra está anulada.».
  - `test_compra_invalida`: sin ítems → 422; insumo archivado → 422 «{nombre} está archivado.»; `en_unidad_compra` en un insumo sin unidad de compra → 422 «Este insumo no tiene unidad de compra.»; cuenta archivada → «Elige una cuenta.»; fecha futura → 422. Ninguna deja compra, movimientos ni transacciones.
  - `test_proveedores_sugeridos`: dos compras de «Hilos La 14» y una de «Murano Express» → `["Hilos La 14", "Murano Express"]`.
- [ ] **Paso 2:** FAIL. **Paso 3: Implementar.** Todo en una transacción. El pago: `UPDATE compra SET cuenta_id=…, actualizado=… WHERE id=… AND cuenta_id IS NULL AND estado='activa'`; si `rowcount == 0`, se lee la compra para decidir entre «ya está pagada» y «está anulada». La anulación: `UPDATE … SET estado='anulada' WHERE estado='activa'`, luego movimientos `anulacion` negativos con `permitir_negativo=True` y `compra_id`, y borra transacción y precios de la compra.
- [ ] **Paso 4:** `uv run pytest -q && uv run ruff check .`.
- [ ] **Paso 5: Commit** «Compras de insumos con varios ítems, pago opcional o después, y anulación».

### Tarea 5: Pantalla Mis cuentas

**Files:**
- Create: `frontend/src/dinero.ts`, `frontend/src/componentes/FormularioMovimiento.tsx`, `frontend/src/componentes/FormularioCuenta.tsx`, `frontend/src/componentes/FormularioGastoFijo.tsx`, `frontend/src/paginas/Cuentas.tsx`, `frontend/src/paginas/Cuentas.test.tsx`, `frontend/src/paginas/Categorias.tsx`
- Modify: `frontend/src/componentes/iconos.tsx`, `Marco.tsx` (+ test), `frontend/src/paginas/Mas.tsx`, `frontend/src/App.tsx`

**Interfaces:**
- Consumes: rutas de las Tareas 1–3.
- Produces:
  - `dinero.ts`: tipos `CuentaSaldo`, `Categoria`, `Movimiento`, `GastoFijo`, `ResumenMes`, `Compra`; `leerPesos(texto: string): number | null` («$ 150.000», «150.000» y «150000» → 150000; vacío o con letras → null); `mesActual(): string` («AAAA-MM» en Bogotá); `nombreMes(mes: string): string` («noviembre»).
  - `FormularioMovimiento({ tipo, inicial?, prellenado?, alGuardar, alCancelar })`: campos según el tipo (monto, categoría en pastillas, cuenta en pastillas, cuenta destino en transferencias, fecha —hoy por defecto—, nota). Sirve para crear y editar.
  - Rutas `/cuentas` y `/cuentas/categorias`; `IconoCuentas` (tarjeta del mockup) e `IconoTransferir` (flechas de `cuentas-mac.html`).
- [ ] **Paso 1: Pruebas que fallan** (`Cuentas.test.tsx` con `simularApi`; `leerPesos` en `formato.test.ts` o en un `dinero.test.ts`):
  - `leerPesos`: «$ 150.000» → 150000, «150000» → 150000, «12,5» → null, «abc» → null.
  - `muestra saldos y el total`: tres tarjetas con nombre y saldo; el subtítulo «Tienes $ 2.184.000 entre tus 3 cuentas»; un saldo negativo con clase de peligro.
  - `resumen del mes con navegación`: «Resumen de noviembre» con entró, salió y ganancia; «Mes anterior» pide `GET /api/cuentas/resumen?mes=2026-10` y `GET /api/movimientos?mes=2026-10`; «Mes siguiente» deshabilitado en el mes actual.
  - `filtra movimientos por cuenta`: tocar «Nequi» pide `…&cuenta_id=2`.
  - `movimiento de venta sin botones y con enlace`: la fila de una venta enlaza a `/ventas/12` y no tiene «Editar» ni «Borrar»; la de un gasto sí, y «Borrar» pide confirmación y manda `DELETE`.
  - `registrar un gasto fijo prellena el formulario`: «Registrar» en «Internet» abre el formulario de gasto con 85.000, Servicios y Nequi, y al guardar manda `gasto_fijo_id`.
  - `transferir`: el botón «Transferir» abre el formulario con «De» y «A»; elegir la misma cuenta muestra «Elige dos cuentas distintas.» sin llamar al servidor.
  - `agregar cuenta`: «Agregar cuenta» → nombre y saldo inicial → `POST /api/cuentas`.
  - En `Marco.test.tsx`: el menú lateral termina en «Clientes», «Mis cuentas»; «Más» lleva a `/cuentas`.
- [ ] **Paso 2:** `npx vitest run` → FAIL.
- [ ] **Paso 3: Implementar** copiando `cuentas-mac.html`: encabezado con fecha, «Mis cuentas», «Tienes $ X entre tus N cuentas» y acciones «Transferir» (pastilla), «Registrar compra de insumos» (pastilla, a `/compras/nueva`) y «Registrar gasto» (principal, a `/cuentas/gasto`); rejilla de saldos `auto-fill minmax(240px,1fr)` con la tarjeta punteada «Agregar cuenta»; rejilla `1.2fr / 1fr` con «Resumen de {mes}» (tres cifras: menta, rosa claro peligro y rosa principal) y a la derecha «Gastos fijos de {mes}» (solo los que faltan; «Editar» lleva a su lista) y «Compras sin pagar» (con «Registrar pago»: cuenta en pastillas y fecha); tabla «Movimientos de {mes}» con pastillas de cuenta. «Otro ingreso» y «Retiro personal» como enlaces junto a «Transferir» en el menú de acciones del encabezado en celular, y como pastillas en Mac. En celular las secciones se apilan y la tabla de movimientos pasa a filas como las de Ventas (sin desplazamiento horizontal). «Categorías» enlaza a `/cuentas/categorias` (lista por tipo con crear, renombrar y archivar). Sección «Mis cuentas» en el menú lateral después de Clientes; fila «Mis cuentas» en «Más» con subtítulo «$ X entre N cuentas»; «Más» de la barra inferior activo también en `/cuentas` y `/compras`.
- [ ] **Paso 4:** `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build`; revisión a ojo a 1440, 390 y 360 px junto a `cuentas-mac.html`.
- [ ] **Paso 5: Commit** «Mis cuentas como en el mockup: saldos, resumen del mes, gastos fijos, compras sin pagar y movimientos».

### Tarea 6: Registrar gasto a pantalla completa

**Files:**
- Create: `frontend/src/paginas/Gasto.tsx`, `frontend/src/paginas/Gasto.test.tsx`
- Modify: `frontend/src/componentes/Marco.tsx` (pantalla completa también en `/cuentas/gasto`), `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `leerPesos`, `recordar`/`recordado` de `ventas.ts`, `GET /api/categorias?tipo=gasto`, `GET /api/cuentas`.
- Produces: ruta `/cuentas/gasto` (acepta `?fijo=<id>` para prellenar desde un gasto fijo).
- [ ] **Paso 1: Pruebas que fallan** en `Gasto.test.tsx`:
  - `lee el monto con puntos de miles`: escribir «150.000» muestra «$ 150.000» en la franja y manda `monto: 150000`.
  - `elige categoría y cuenta y guarda`: tocar «Stand de feria» y «Efectivo», «Guardar gasto» manda `{tipo: "gasto", monto, categoria_id, cuenta_id, fecha: null, nota: null}` y vuelve a `/cuentas`.
  - `recuerda la última cuenta`: tras guardar con Nequi, al volver a abrir Nequi está elegida.
  - `sin monto no guarda`: el botón dice «Escribe el monto» y está deshabilitado.
  - `agregar nota`: «Agregar nota» muestra el campo y la nota se envía.
- [ ] **Paso 2:** FAIL. **Paso 3: Implementar** copiando la tercera pantalla de `cuentas-celular.html`: encabezado con volver y «Registrar gasto»; tarjeta «¿Cuánto?» con el monto en 40 px 800 centrado; pasos «1. ¿En qué?» (categorías de gasto en pastillas) y «2. ¿De dónde salió?» (cuentas); franja fija con «{categoría} · {cuenta}», el total en 26 px, chip «Agregar nota» y botón «Guardar gasto» de 56 px. En Mac se ve centrada a 720 px como Vender.
- [ ] **Paso 4:** verificación completa de la interfaz y revisión a ojo a 390 y 360 px.
- [ ] **Paso 5: Commit** «Registrar gasto en dos toques desde el celular, como la venta rápida».

### Tarea 7: Pantallas de compras

**Files:**
- Create: `frontend/src/paginas/NuevaCompra.tsx`, `Compras.tsx`, `Compra.tsx`, `Compras.test.tsx`
- Modify: `frontend/src/paginas/Productos.tsx` (el botón «Registrar compra de insumos» va a `/compras/nueva`), `frontend/src/paginas/Insumos.tsx` (el mismo botón, pastilla, junto a «Nuevo insumo»), `frontend/src/App.tsx`

**Interfaces:**
- Consumes: rutas de la Tarea 4; `GET /api/inventario/insumos` para elegir insumos (con `unidad`, `unidad_compra`, `factor_compra`, `precio_unitario`).
- Produces: rutas `/compras`, `/compras/nueva`, `/compras/:id`.
- [ ] **Paso 1: Pruebas que fallan** en `Compras.test.tsx`:
  - `arma una compra con dos insumos`: «Agregar insumo» abre un buscador de insumos; elegir el hilo agrega una fila con su precio vigente por cono prellenado si tiene unidad de compra (precio × factor); cambiar a «metros» recalcula el precio por metro; el total muestra «$ 66.000»; «Nequi» y «Guardar compra» mandan el cuerpo de la Tarea 4 y llevan a `/compras/<id>`.
  - `después deja la compra sin pagar`: con «Después», `cuenta_id: null`.
  - `quitar un insumo`: el botón «Quitar {insumo}» saca la fila y el total baja.
  - `proveedor sugerido`: el campo Proveedor ofrece los de `GET /api/compras/proveedores` (`<datalist>`).
  - `detalle con pago y anulación`: en `/compras/7` sin pagar, «Registrar pago» con Efectivo manda `POST /api/compras/7/pago`; «Anular compra» pide confirmación nombrada («¿Anular la compra N.º 0007? Los insumos salen del inventario y el pago se borra.») y manda `POST …/anular`.
  - `lista de compras`: filas con fecha, «N.º», proveedor, total y «Sin pagar» o la cuenta.
- [ ] **Paso 2:** FAIL. **Paso 3: Implementar** copiando `compra-mac.html`: encabezado «Registrar compra», subtítulo y «Cancelar»; tarjeta con Proveedor y Fecha; filas con muestra de color del tipo de insumo, cantidad, selector «Contado en» (unidad de compra / unidad propia, solo si el insumo tiene unidad de compra), precio c/u, subtotal y quitar; «Agregar insumo» punteado; pie con «¿La pagaste?» (cuentas activas + «Después»), cantidad de insumos, total en 34 px y «Guardar compra». En celular cada fila se apila (insumo arriba; cantidad, unidad y precio debajo) sin desplazamiento horizontal. Lista y detalle con las piezas de Ventas y Venta.
- [ ] **Paso 4:** verificación completa de la interfaz y revisión a ojo a 1440, 390 y 360 px.
- [ ] **Paso 5: Commit** «Registrar compra de insumos como en el mockup, lista de compras y detalle con pago y anulación».

### Tarea 8: Versión 0.5.0

- [ ] Subir a `0.5.0` en `backend/app/version.py`, `frontend/package.json` y `frontend/package-lock.json`.
- [ ] Verificación completa de backend y frontend; commit «Mis cuentas y compras: versión 0.5.0».

## Después de las tareas

- Revisión final de toda la rama, correcciones, push de `clientes-cuentas`, PR a `main` y merge (el usuario lo pidió).
