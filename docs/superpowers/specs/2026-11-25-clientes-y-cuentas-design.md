# Clientes y Mis cuentas: diseño

Fecha: 25/11/2026. Cierra la Fase 1 de `docs/arquitectura.md` (fila Clientes y fila Contabilidad de «Módulos funcionales»), salvo los respaldos y la instalación en la Mac.

## Para qué

Ella necesita saber **quién le compra** y **cuánto entra, cuánto sale y cuánto queda** en cada cuenta (Efectivo, Nequi, Daviplata y las que agregue). Hoy la app registra ventas e inventario, pero:

- Toda venta queda a nombre de «Cliente de mostrador»: no hay forma de saber quién compró.
- Las cuentas suman ventas, pero no hay gastos, transferencias, retiros ni una pantalla para ver los saldos.
- Comprar insumos sube el inventario y el precio, pero no saca plata de ninguna cuenta, aunque la spec dice que «cada compra crea un egreso». Los saldos saldrían inflados.

Ella no va a usar el programa hasta que esté completo, así que no importa que la ficha de cliente se vea pobre mientras no existan los encargos (Fase 2).

## Objetivos

1. Elegir la clienta en la venta rápida, con «Cliente de mostrador» por defecto.
2. Pantalla Clientes: lista con buscador y ficha con contactos, WhatsApp, total comprado, por cobrar e historial.
3. Pantalla Mis cuentas: saldo de cada cuenta; registrar gasto, otro ingreso, transferencia y retiro personal; gastos fijos que ella define; resumen del mes.
4. Compras de insumos con varios insumos y un pago opcional, que se puede registrar después. Anular una compra mal hecha.
5. Pantallas nuevas dibujadas antes en `docs/mockups/fuentes/`, copiando los valores exactos de los mockups existentes.

## Fuera de alcance

- Encargos, abonos, cartera real, envíos y dirección obligatoria (Fase 2). La ficha muestra «Por cobrar», que da $ 0 mientras solo existan ventas rápidas.
- Bloquear meses cerrados (el usuario eligió un resumen consultable, sin bloqueo).
- Pagos parciales de una compra, deudas con proveedores y ficha de proveedor.
- Respaldos, exportes a Excel y estadísticas.

## Cosas que no deben pasar

- Que registrar un gasto o elegir clienta haga la venta más lenta: la venta rápida sigue siendo de 3 toques si no se toca el chip de cliente.
- Que un saldo cambie sin que ella haya hecho algo: los gastos fijos **nunca** se descuentan solos.
- Que una pantalla nueva se vea genérica o distinta de los mockups.
- Que borrar o corregir un movimiento descuadre una venta o una compra: lo que nace de una venta o una compra solo se cambia anulándolas.

## Enfoques considerados para la compra de insumos

| Enfoque | A favor | En contra |
|---|---|---|
| A. Pago pegado a cada entrada de insumo | Pequeño, usa la pantalla actual | Un pago por factura se reparte en varias entradas |
| **B. Compra con varios insumos y un solo pago (elegido)** | Así compra ella; usa el botón «Registrar compra de insumos» del mockup; deja el pago para después sin enredos | Pantalla nueva y más trabajo |
| C. Inventario y gasto por separado | Nada que cambiar en inventario | Se anota dos veces lo mismo; choca con «menos de un minuto» |

El usuario eligió B.

## Decisiones del usuario

- La venta rápida permite elegir clienta; por defecto es «Cliente de mostrador».
- El pago de una compra es **opcional** al registrarla. Si se le pasó, lo registra después eligiendo de qué cuenta salió, y solo entonces se descuenta.
- Las pantallas nuevas se diseñan a partir de las existentes, con fidelidad exacta.
- Cierre mensual = **resumen consultable** del mes, sin bloquear movimientos.
- Se entrega en dos planes: 1) Clientes, 2) Mis cuentas con compras.

## Diseño

### Plan 1 · Clientes (versión 0.4.0)

**Datos.** `Cliente` ya existe (nombre, whatsapp, direccion, ciudad, instagram, correo, cedula, notas, es_mostrador). Se agrega `activo` (archivar, como en inventario). `instagram` se muestra como «Instagram o TikTok».

**Crear y editar.** Obligatorios: nombre y WhatsApp. Lo demás es opcional. *(Decisión de Claude: la spec pide también dirección y ciudad, pero sirven para envíos y frenarían una venta en la feria; se volverán obligatorias para encargos con envío en la Fase 2.)* Si el WhatsApp ya es de otra clienta activa, 409 «Ya tienes a {nombre} con ese WhatsApp.». El WhatsApp se guarda solo con dígitos y con indicativo: si tiene 10 y empieza por 3, se le antepone 57. Así «300 456 7812», «+57 300-456-7812» y «573004567812» son el mismo número. El enlace es `https://wa.me/<dígitos>` y en pantalla un número colombiano se ve «300 456 7812».

**«Cliente de mostrador».** No sale en la lista ni se puede editar o archivar.

**API** (`/api/clientes`): listar con `buscar` (nombre, WhatsApp o Instagram, sin tildes ni mayúsculas) y `archivados`; crear; ver ficha; editar; archivar y recuperar. La ficha trae: total comprado (Σ total de pedidos no cancelados), por cobrar (Σ total − Σ pagos de pedidos no cancelados), número de compras, compra promedio, canal que más usa, cliente desde (fecha de creación), última compra e historial (fecha, número, productos, total, estado), del más reciente al más viejo.

**Venta rápida.** `VentaEntrada.cliente_id` opcional; si falta, va a mostrador. Clienta archivada o inexistente: 422 «Elige una clienta de la lista.». El chip de la franja fija abre una hoja desde abajo con buscador, la lista de clientas y «+ Nueva clienta» (nombre y WhatsApp, que al guardarse queda elegida). Tras guardar la venta, el chip vuelve a mostrador (canal y cuenta se siguen recordando). El comprobante y el detalle de la venta muestran el nombre de la clienta. La lista de ventas del día muestra la clienta cuando no es mostrador.

**Pantallas.** Mac: «Clientes» en el menú lateral (ícono del mockup), lista a la izquierda y ficha a la derecha. Celular: fila «Clientes» en «Más»; lista y ficha en pantallas separadas. Mockup: `docs/mockups/fuentes/clientes-mac.html` y la hoja de cliente en `docs/mockups/fuentes/cuentas-celular.html`.

### Plan 2 · Mis cuentas y compras (versión 0.5.0)

**Datos.**
- `Categoria.tipo`: `ingreso`, `gasto` o `retiro`. Se agrega `activa`. Se siembran: gasto (Insumos, Envíos, Publicidad, Stand de feria, Empaques, Transporte, Servicios, Otros gastos), retiro (Retiro personal), ingreso (Ventas, que ya existe, y Otros ingresos). Se pueden crear, renombrar y archivar; «Ventas», «Insumos» y «Retiro personal» no se archivan porque la app las usa.
- `Transaccion`: se agregan `cuenta_destino_id` (transferencias), `compra_id`, `gasto_fijo_id` y `nota`. Tipos: `ingreso`, `egreso`, `transferencia`. Un retiro es un egreso con categoría de tipo `retiro`.
- `GastoFijo`: nombre, monto aproximado, categoría, cuenta sugerida, activo.
- `Compra`: fecha, proveedor (texto, con sugerencias de los ya usados), total, cuenta_id (vacía = sin pagar), estado (`activa` o `anulada`), nota, actualizado.
- `MovimientoInventario.compra_id` y `PrecioInsumo.compra_id`, para saber qué entró y qué precio fijó cada compra.

**Saldo de una cuenta** = saldo inicial + ingresos − egresos − transferencias que salen + transferencias que entran. Puede quedar negativo: se muestra en rojo («Bajo mínimo») y no impide guardar. *(Decisión de Claude.)*

**Cuentas.** Agregar (nombre y saldo inicial), renombrar, cambiar saldo inicial y archivar. Archivada no sale en la venta, los gastos ni las compras, pero sus movimientos siguen. La venta rápida ya lista las cuentas activas, así que una cuenta nueva aparece sola como forma de pago.

**Movimientos manuales.** Gasto (monto, categoría de gasto, cuenta, fecha, descripción opcional), otro ingreso (igual con categoría de ingreso), retiro personal (monto, cuenta, fecha) y transferencia (monto, de, a, fecha; de y a distintas). Se pueden editar y borrar. Los que tienen `pago_id` o `compra_id` no: muestran «Viene de la venta N.º 0012» o «Viene de la compra N.º 0003» con enlace.

**Gastos fijos.** Ella los define. Mis cuentas muestra «Gastos fijos de {mes}»: los que no tienen un movimiento con su `gasto_fijo_id` en el mes en curso, cada uno con «Registrar», que abre el formulario de gasto prellenado (puede cambiar el monto). Nunca se registran solos.

**Resumen del mes (cierre).** Selector de mes. Muestra: entró (ventas + otros ingresos), salió (gastos, sin retiros ni transferencias), ganancia = entró − salió, retiros personales, gastos por categoría y saldo de cada cuenta al último día del mes. Es flujo de caja, no utilidad con costo. Se calcula al pedirlo; no se guarda ni bloquea nada.

**Compras.**
- «Registrar compra de insumos» (Inventario, pestaña Productos e Insumos, y Mis cuentas) abre `/compras/nueva`: proveedor, fecha (hoy por defecto, editable), filas de insumo con cantidad (en unidad propia o de compra, como la entrada actual) y precio por esa unidad, «+ Agregar insumo», total calculado (redondeado a peso) y «¿La pagaste?» con las cuentas activas y «Después».
- Al guardar, en una sola transacción: la compra, un movimiento `compra` por insumo con `compra_id` y costo unitario, un `PrecioInsumo` de origen `compra` por insumo y, si eligió cuenta, un egreso categoría Insumos con `compra_id`, fecha de la compra y descripción «Compra N.º 0003 · {proveedor}».
- «Compras sin pagar» en Mis cuentas, cada una con «Registrar pago» (cuenta y fecha, hoy por defecto). Crea el egreso con esa fecha. Pagar dos veces: 409 «Esta compra ya está pagada.».
- `/compras` lista las compras (fecha, número, proveedor, insumos, total, pagada en / sin pagar) y `/compras/:id` es el detalle con «Anular compra». Anular (condicional, como la venta): movimientos `anulacion` negativos por cada insumo, borra el egreso y los `PrecioInsumo` de esa compra; el stock puede quedar negativo, como en producción. 409 si ya estaba anulada.
- La «Entrada» suelta de un insumo se queda como está, para ajustes sin plata.

**Pantallas.**
- Mac: «Mis cuentas» en el menú lateral. Encabezado con «Registrar gasto» (principal) y «Transferir» (pastilla). Tarjetas de saldo por cuenta, tarjeta del resumen del mes, gastos fijos pendientes, compras sin pagar y tabla de movimientos del mes con filtro por cuenta. Mockup: `docs/mockups/fuentes/cuentas-mac.html`.
- Registrar compra en Mac: `docs/mockups/fuentes/compra-mac.html`.
- Celular: filas «Mis cuentas» en «Más». Registrar gasto en pantalla completa como la venta rápida: monto grande, «1. ¿En qué?» (categorías en pastillas), «2. ¿De dónde salió?» (cuentas en pastillas), descripción opcional y franja fija «Guardar gasto». Mockup: `docs/mockups/fuentes/cuentas-celular.html`.

**Pantallas sin mockup propio**, armadas con las mismas piezas: Mis cuentas en celular (las secciones de la Mac apiladas), la lista y la ficha de clientes en celular, la lista y el detalle de compras (como Ventas y el detalle de una venta), los formularios de transferencia, otro ingreso, retiro, cuenta, gasto fijo y categorías (como los formularios de inventario, con `Formulario.tsx`). En la Mac, el formulario de gasto tiene fecha editable (hoy por defecto); en el celular la fecha es hoy. Cada fila de movimiento manual tiene «Editar» y «Borrar» con confirmación nombrada. Las categorías se administran desde un enlace «Categorías» en Mis cuentas.

**Mockups.** Se agregan a la tabla de `docs/mockups/README.md` y a la lista de fuentes de la skill `diseno-lya`.

**Inicio.** No cambia en este plan (las tarjetas de ganancia del mockup de Inicio llegan con Estadísticas).

## Qué queda a criterio del constructor

- Nombres de funciones, archivos y orden de las tareas, siguiendo los planes anteriores (paquete `app/clientes/` y `app/cuentas/`, migraciones `0005` en adelante).
- Cómo partir los componentes de interfaz, reutilizando `ui.tsx`, `Formulario.tsx` y los íconos existentes.
- Mensajes de error no listados aquí, en el mismo tono.
