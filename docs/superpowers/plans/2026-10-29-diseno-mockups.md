# Diseño según los mockups — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todas las pantallas que ya existen se vean como `docs/mockups/mockups.html`: inicio de sesión, marco con menú lateral y barra inferior, Inicio, Inventario (productos e insumos), venta rápida y ventas. Las pantallas futuras partirán de las mismas piezas.

**Architecture:** Primero, una base visual: tokens en `tema.css`, Fraunces, íconos `lucide-react` y componentes compartidos de interfaz en `componentes/ui.tsx`. Después, una tarea por pantalla que la rehace con esas piezas, sin cambiar su lógica ni su API. La única pieza nueva de backend es `GET /api/inicio`, con las cifras que piden las tarjetas de Inicio y que hoy no se calculan juntas.

**Tech Stack:** React 19, Tailwind v4, `@fontsource/fraunces` (nuevo), `lucide-react` (nuevo), Vitest; FastAPI para `/api/inicio`.

**Spec:** `docs/mockups/mockups.html` y `docs/mockups/README.md`, con los valores ya extraídos en la skill `.claude/skills/diseno-lya/SKILL.md`. También la sección «Identidad visual» de `docs/arquitectura.md`.

**Rama:** `diseno-mockups`, creada desde `main`. Si el PR #58 (pendientes de ventas) todavía no está unido, se une antes de empezar la Tarea 6, porque las dos tocan `Vender.tsx`.

## Global Constraints

- Carga la skill `diseno-lya` antes de cada tarea. Sus valores de color, letra, radio y sombra son los que valen.
- Fraunces 600 solo para títulos. Nunito para todo lo demás. Las dos se incluyen con `@fontsource`: nada de Google Fonts ni CDN, porque la app funciona sin internet.
- Íconos de `lucide-react` (se importa cada ícono por separado, así el paquete solo lleva los que se usan). Si un ícono va sin texto, lleva `aria-label`.
- No cambia ninguna regla de negocio ni ninguna ruta de API, salvo `GET /api/inicio`. Cuando un texto cambia, sus pruebas cambian con él y en el mismo commit.
- Lo que el mockup muestra y todavía no existe no se dibuja como si existiera: Pedidos, Clientes, Mis cuentas, Estadísticas, Calendario, Ganancia, Por cobrar, la gráfica de ventas, «En producción», «Reservado» y la campana de avisos. Cada cosa aparece con su módulo.
- Celular desde 360 px, sin desplazamiento horizontal, botones de al menos 44 px. Safari 17.6.
- Modo oscuro: los tokens nuevos se redefinen bajo `prefers-color-scheme: dark`, con contraste de al menos 4,5:1 para el texto.
- Cada tarea termina con una comparación lado a lado en el navegador: el mockup servido con `python -m http.server` en `docs/mockups` contra la pantalla real, a 1440 px y a 390 px, y la misma pantalla a 360 px.

## Review Focus

- **La barra inferior a 360 px**, con el «+» central y cuatro secciones: nada se encima, cada destino mide al menos 44 px y el «+» no tapa contenido. Prueba en la Tarea 2 (`test("barra inferior: cuatro secciones y el + de nueva venta")`) más la medición manual.
- **La venta rápida en el celular a pantalla completa**, con la franja fija abajo: el botón «Guardar venta» queda sobre la raya de inicio del iPhone (`env(safe-area-inset-bottom)`) y el último producto se puede tocar sin quedar debajo de la franja. Prueba en la Tarea 6.
- **Nombres largos de modelo o de color en las tarjetas** («Bolso balde con argollas doradas y forro»): dos líneas como máximo, sin romper la cuadrícula. Prueba en las Tareas 5 y 6.
- **El iPhone en modo oscuro**: la pastilla elegida, oscura en el mockup, no puede desaparecer sobre el fondo oscuro. En oscuro se invierte: fondo claro y texto oscuro. Prueba en la Tarea 1 (tokens) más la revisión manual.
- **Inicio sin ventas ni productos** (primer día): las tarjetas dicen «$ 0», «0 piezas» y «Todo el inventario está en orden.», nunca un error ni un hueco. Prueba en la Tarea 4.

---

## Estructura de archivos

```
.claude/skills/diseno-lya/SKILL.md     valores y reglas (ya creada con este plan)
CLAUDE.md                              apunta a la skill (ya creado)
frontend/src/tema.css                  tokens nuevos, claro y oscuro
frontend/src/componentes/ui.tsx        Titulo, Encabezado, BotonPrincipal, BotonPastilla,
                                       Pastillas, Pestanas, TarjetaCifra, Etiqueta, FotoProducto
frontend/src/componentes/Marco.tsx     menú lateral (Mac) y barra inferior (celular)
frontend/src/paginas/Mas.tsx           «Más» del celular
frontend/src/paginas/Inventario.tsx    pestañas Productos en vitrina / Insumos
backend/app/inicio.py                  GET /api/inicio
```

---

### Tarea 1: Base visual — tokens, letras, íconos y componentes compartidos

**Mockup:** todos (la paleta, las letras y las formas de la skill).

**Files:**
- Modify: `frontend/package.json` y el lockfile (`@fontsource/fraunces`, `lucide-react`), `frontend/src/tema.css`, `frontend/src/main.tsx` (importar Fraunces 600 y 600 cursiva)
- Create: `frontend/src/componentes/ui.tsx`, `frontend/src/componentes/ui.test.tsx`
- Modify: `frontend/src/componentes/Formulario.tsx` (`Boton` y `BotonSecundario` pasan a ser pastillas con los colores nuevos; `Campo` con radio de 14 px y borde `borde`)

**Interfaces:**
- Produces:
  - **Tokens en `tema.css`:** `rosa`, `rosa-oscuro` (#B83467), `rosa-claro` (#FBEAF2), `rosa-palo` (#E8AFCB), `tinta`, `tinta-media` (#4A3D44), `suave` (#6E5F67), `fondo`, `superficie`, `borde` (#F6E6EE), `ok`/`ok-fondo`, `alerta`/`alerta-fondo`, `peligro`/`peligro-fondo`, `lila`/`lila-fondo`, `dorado`, `elegido`/`sobre-elegido` (#1F1A1D/blanco; en oscuro, claro/oscuro).
  - **Fuentes y sombras:** `--font-titulo: "Fraunces", Georgia, serif`, más las sombras `--shadow-tarjeta` y `--shadow-boton`.
  - **`ui.tsx`:**
    - `Titulo({ children, nivel?: 1|2 })`: h1 o h2, Fraunces 600; 26/40 px en h1 (celular/Mac) y 20 px en h2.
    - `Encabezado({ fecha?: boolean, titulo, subtitulo?, acciones? })`: la fecha larga de Bogotá («Jueves, 29 de octubre») sale con `fechaLarga()`, que se agrega a `formato.ts`.
    - `BotonPrincipal`: pastilla rosa con sombra; acepta `icono`; renderiza `<button>` o, con `a`, `<Link>`.
    - `BotonPastilla`: pastilla blanca con borde.
    - `Pastillas({ etiqueta, opciones, valor, alElegir })`: grupo de una opción con `aria-pressed`, pintado con `elegido`. Reemplaza `Eleccion` de Vender y los filtros de Productos e Insumos.
    - `Pestanas({ etiqueta, pestanas: {a, texto}[] })`: `NavLink` dentro de una pastilla rosa claro.
    - `TarjetaCifra({ titulo, cifra, detalle?, tono?: "normal"|"rosa"|"suave" })`.
    - `Etiqueta({ estado: EstadoStock })`: reemplaza `Estado.tsx`, con los textos «En stock», «Por agotarse» y «Bajo mínimo».
    - `FotoProducto({ foto, categoria, nombre })`: la foto o el color de la categoría con el ícono `ShoppingBag`.

- [ ] **Step 1: Write the failing tests** en `ui.test.tsx`:
  - `Pastillas` marca con `aria-pressed="true"` solo la elegida y llama a `alElegir` con el valor.
  - `Etiqueta` muestra «En stock», «Por agotarse» y «Bajo mínimo».
  - `FotoProducto` sin foto tiene la clase de fondo de su categoría (`bg-rosa-claro` para crochet, `bg-ok-fondo` para murano, `bg-lila-fondo` para cristal, `bg-alerta-fondo` para otro) y con foto muestra `<img>` con `src` de la miniatura.
  - `fechaLarga("2026-10-29T15:00:00Z") === "Jueves, 29 de octubre"`, en `formato.test.ts`.
- [ ] **Step 2: Run them to verify they fail.**
  Run: `cd frontend && npx vitest run src/componentes/ui.test.tsx src/formato.test.ts`
  Expected: FAIL, porque `ui.tsx` no existe.
- [ ] **Step 3: Implement.** Instala `@fontsource/fraunces` y `lucide-react`, define los tokens claro y oscuro, escribe `ui.tsx` y `fechaLarga`, y cambia `Estado` por `Etiqueta` donde se use.
- [ ] **Step 4: Run every frontend check.**
  Run: `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build`
  Expected: todo pasa. Las pruebas que buscaban «En stock» con otro texto se actualizan.
- [ ] **Step 5: Commit** «Base visual de los mockups: Fraunces, paleta, íconos y componentes compartidos».

---

### Tarea 2: Marco — menú lateral en la Mac y barra inferior con «+» en el celular

**Mockup:** «Inicio · Mac» (menú lateral) e «Inicio · Celular» (encabezado y barra inferior).

**Files:**
- Modify: `frontend/src/componentes/Marco.tsx`, `frontend/src/App.tsx`
- Create: `frontend/src/paginas/Mas.tsx`, `frontend/src/componentes/Marco.test.tsx`

**Interfaces:**
- Consumes: `ui.tsx`, `AccesoCelular`.
- Produces:
  - **Mac (desde `md`):**
    - Menú lateral fijo de 240 px, fondo `rosa-claro`, logo redondo de 150 px (`/logo.webp`).
    - Secciones con ícono:
      - Inicio (`House`), a `/`.
      - Ventas (`ShoppingBag`), a `/ventas`.
      - Inventario (`Package`), a `/inventario`; queda activa también en `/productos/*` e `/insumos/*`.
    - La sección activa va en una pastilla blanca, con texto rosa.
    - Abajo, la tarjeta punteada «Entrar desde el celular», que abre `AccesoCelular` en la misma tarjeta, y «Salir».
  - **Celular:**
    - Encabezado con el logo de 40 px, «L&A» en Fraunces cursiva y sin campana.
    - Barra inferior fija, blanca, de radio 28 px y con sombra: Inicio, Ventas, «+» y Más.
      - El «+» es un círculo rosa de 60 px que sobresale, con `aria-label="Nueva venta"`, y lleva a `/vender`.
      - Inventario va entre el «+» y Más.
      - Cada sección lleva su ícono con el texto debajo, a 11 px y 700.
    - En `/vender`, el marco no muestra ni la barra ni el encabezado, porque la venta rápida va a pantalla completa.
  - **`/mas`:** lista con «Entrar desde el celular» y «Salir». Solo existe en el celular; en la Mac redirige a `/`.

- [ ] **Step 1: Write the failing tests** en `Marco.test.tsx`:
  - `test("barra inferior: cuatro secciones y el + de nueva venta")`: con el enlace «Nueva venta» con `href="/vender"` y los enlaces Inicio, Ventas, Inventario y Más.
  - `test("Inventario queda activo en la ficha de un producto")`: con la ruta `/productos/7`, el enlace Inventario tiene `aria-current="page"`.
  - `test("la venta rápida no muestra la barra")`: con la ruta `/vender`, no existe la navegación «Secciones».
  - `test("Más ofrece entrar desde el celular y salir")`.
- [ ] **Step 2: Run them to verify they fail.**
  Run: `cd frontend && npx vitest run src/componentes/Marco.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement** el marco y `Mas.tsx`. Inicio deja de mostrar el botón «Entrar desde el celular», que ahora vive en el menú y en Más.
- [ ] **Step 4: Run every frontend check.** Además se mide la barra a 360 px en el navegador: cada destino mide al menos 44 px y no hay desplazamiento horizontal.
- [ ] **Step 5: Commit** «Marco de los mockups: menú lateral con logo y barra inferior con botón de venta».

---

### Tarea 3: Inicio de sesión, crear cuenta y recuperar acceso

**Mockup:** «Inicio de sesión · Mac».

**Files:**
- Modify: `frontend/src/componentes/Formulario.tsx` (`Tarjeta` pasa a ser el diseño partido), `frontend/src/paginas/Entrar.tsx`, `CrearCuenta.tsx`, `Recuperar.tsx`, `CodigoRecuperacion.tsx` y sus pruebas

**Interfaces:**
- Produces:
  - `Tarjeta({ titulo, subtitulo, children })`. En la Mac es un panel izquierdo `rosa-palo` con el logo de 360 px y «Bolsos y accesorios hechos a mano, con todo en orden.», y a la derecha el formulario de 360 px sobre `fondo`. En el celular, el logo de 120 px va arriba y el formulario debajo.
  - Entrar:
    - Título «¡Qué bueno verte!» y subtítulo «Entra para ver tus ventas, pedidos e inventario.».
    - Campos «Usuario» y «Contraseña», esta con el botón de ojo «Mostrar contraseña» / «Ocultar contraseña».
    - Botón «Entrar» y el recuadro rosa claro «¿Olvidaste tu contraseña? Usa el código de 8 dígitos que viene en tu guía de instalación. Recuperar acceso».
  - No se agrega «Recordarme en este equipo»: la sesión ya dura 30 días en ese equipo, así que la casilla no haría nada.

- [ ] **Step 1: Write the failing tests.**
  - Entrar muestra «¡Qué bueno verte!».
  - El ojo cambia el `type` de la contraseña a `text` y vuelve.
  - El enlace «Recuperar acceso» va a `/recuperar`.
  - Se actualizan los textos en las pruebas existentes de Entrar y CrearCuenta.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run every frontend check** y compara con el mockup a 1440 px y a 390 px.
- [ ] **Step 5: Commit** «Inicio de sesión como en los mockups».

---

### Tarea 4: Inicio con tarjetas de cifras y «Para no olvidar»

**Mockup:** «Inicio · Mac» e «Inicio · Celular».

**Files:**
- Create: `backend/app/inicio.py`, `backend/tests/test_inicio.py`
- Modify: `backend/app/principal.py`, `frontend/src/paginas/Inicio.tsx` y su prueba en `Insumos.test.tsx` (se pasa a `Inicio.test.tsx`)

**Interfaces:**
- Consumes: `limites_del_dia`, `hoy_bogota`, `existencias`, `estado_stock`, `Pedido`.
- Produces:
  - `GET /api/inicio`, con sesión obligatoria. Responde `{ ventas_hoy: { total, cantidad, por_canal: {canal: cantidad} }, ventas_mes: { total, cantidad, mes: "octubre" }, vitrina: { piezas, valor }, avisos: [{ tipo: "producto"|"insumo", id, nombre, detalle, estado }] }`.
    - Las ventas excluyen las anuladas.
    - `vitrina` suma las existencias de las variantes activas. `valor` es la suma de existencia × precio de venta.
    - `avisos` trae hasta 5 ítems en `bajo_minimo` o `por_agotarse`, los rojos primero.
      - De un insumo, `nombre` es su nombre y `detalle` dice «Quedan 2,5 metros · mínimo 5».
      - De una variante, `nombre` es «Bolso balde · Rosa palo» y `detalle` dice «Quedan 1 · mínimo 2».
  - Inicio:
    - Arriba, `Encabezado` con la fecha y «¡Hola de nuevo!». En la Mac, a la derecha, «+ Nueva venta».
    - Tarjetas:
      - En el celular, «Vendiste hoy» grande en rosa, con «3 ventas · 2 por Instagram, 1 presencial» y un aviso cuando no hay ventas.
      - En la Mac, «Ventas de octubre».
      - En los dos, «En vitrina: 46 piezas» con «$ 3.920.000 a precio de venta».
    - «Para no olvidar» en el celular, «Avisos de hoy» en la Mac: filas con un punto de color según el estado y una flecha. Cada fila enlaza a su ficha. Sin avisos dice «Todo el inventario está en orden.».

- [ ] **Step 1: Write the failing tests.**
  - En `test_inicio.py`:
    - `test_inicio_sin_datos` da ceros y `avisos == []`.
    - `test_inicio_cuenta_ventas_vitrina_y_avisos`: con dos ventas, una anulada, y un insumo bajo el mínimo, da `ventas_hoy.cantidad == 1`, `por_canal == {"instagram": 1}`, `vitrina.valor` correcto y el aviso del insumo primero.
    - `test_inicio_exige_sesion`.
  - En `Inicio.test.tsx`:
    - Muestra «Vendiste hoy» con «$ 240.000» y «1 venta · 1 por Instagram».
    - Muestra «En vitrina» con «46 piezas».
    - Un aviso enlaza a `/insumos/5`.
    - El primer día muestra «$ 0» y «Todo el inventario está en orden.».
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement** la ruta y la pantalla. La tarjeta anterior «Ventas de hoy» y `Resumen` desaparecen, porque `/api/inicio` las reemplaza.
- [ ] **Step 4: Run every backend and frontend check** y compara con los dos mockups.
- [ ] **Step 5: Commit** «Inicio como en los mockups: cifras del día y del mes, vitrina y avisos».

---

### Tarea 5: Inventario con pestañas, tarjetas de modelo y tabla de insumos

**Mockup:** «Inventario · Mac».

**Files:**
- Create: `frontend/src/paginas/Inventario.tsx`
- Modify: `frontend/src/App.tsx` (`/inventario` redirige a `/productos`; `/productos` e `/insumos` se muestran dentro de `Inventario`), `Productos.tsx`, `Insumos.tsx`, `Modelo.tsx`, `Insumo.tsx` y sus pruebas

**Interfaces:**
- Consumes: `Pestanas`, `Pastillas`, `FotoProducto`, `Etiqueta`, `BotonPrincipal`.
- Produces:
  - `Inventario`:
    - Título «Inventario» y subtítulo «{piezas} piezas en vitrina · {n} insumos por revisar», con las cifras de `/api/inicio`.
    - Pestañas «Productos en vitrina» (`/productos`) e «Insumos» (`/insumos`).
    - Acciones «Registrar compra de insumos» (va a `/insumos`) y «+ Nuevo modelo».
  - **Productos:**
    - Pastillas Todos / Crochet / Murano / Cristal / Otros.
    - Cuadrícula de tarjetas de 4 columnas en la Mac y 2 en el celular. Cada tarjeta lleva `FotoProducto` con `Etiqueta` arriba a la derecha, la categoría en mayúsculas de 11 px y 800, el nombre en 15 px y 800 con un máximo de 2 líneas, «{n} colores» y «{n} en vitrina», y el precio en 16 px y 800.
    - Los botones «Agregar modelo» y «Agregar el primer modelo» pasan a decir «Nuevo modelo» y «Crear el primer modelo».
  - **Insumos:**
    - En la Mac, una tabla con Insumo, Total, Disponible y Estado; las columnas En producción y Reservado esperan a la fase 2. En el celular, tarjetas.
    - «Agregar insumo» pasa a «Nuevo insumo».
  - **Fichas de Modelo e Insumo:** `Encabezado`, tarjetas blancas de radio 24 y las acciones como `BotonPastilla`, sin cambiar la lógica.

- [ ] **Step 1: Write the failing tests** (y actualiza los textos en `Productos.test.tsx` e `Insumos.test.tsx`).
  - `test("inventario tiene pestañas de productos e insumos")`.
  - `test("tarjeta de modelo con estado, categoría y unidades")`: muestra «Por agotarse», «CROCHET» y «1 en vitrina».
  - `test("nombre largo se corta en dos líneas")`: la clase `line-clamp-2` en el nombre.
  - `test("insumos en tabla con disponible")` en la Mac.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run every frontend check** y compara con el mockup a 1440 px y a 390 px, con un nombre largo.
- [ ] **Step 5: Commit** «Inventario como en los mockups: pestañas, tarjetas de modelo y tabla de insumos».

---

### Tarea 6: Venta rápida en tres pasos y confirmación

**Mockup:** «Venta rápida · Celular». En la Mac, la misma pantalla centrada a 720 px y dentro del marco.

**Files:**
- Modify: `frontend/src/paginas/Vender.tsx`, `Venta.tsx`, `Ventas.tsx` y sus pruebas

**Interfaces:**
- Consumes: `Pastillas`, `FotoProducto`, `BotonPrincipal`, `Titulo`.
- Produces:
  - **Vender:**
    - Botón de volver redondo (`aria-label="Volver"`, al lugar de donde vino), título «Venta rápida» y chip «3 toques».
    - **«1. ¿Qué vendiste?»:**
      - A la derecha, el enlace «Buscar», que muestra el campo de búsqueda.
      - Tarjetas de 2 columnas con `FotoProducto`, nombre (2 líneas como máximo), color y precio.
      - La tarjeta elegida lleva borde rosa, sombra y un círculo rosa con ✓ y la cantidad.
    - **«2. ¿Por dónde te compró?»:** las pastillas de los 5 canales.
    - **«3. ¿Cómo te pagó?»:** las pastillas de las cuentas.
    - **«Más opciones»:** se despliega para el descuento y la fecha.
    - **Franja fija abajo:**
      - Blanca, de radio 28 px arriba y con relleno `env(safe-area-inset-bottom)`.
      - Lleva «{n} producto(s)», el total en 26 px y 800, el chip «Cliente de mostrador» con el ícono `User` y «Guardar venta».
      - La pantalla deja abajo un relleno igual a la altura de la franja, para que el último producto quede visible.
  - **Venta recién guardada:** tarjeta de confirmación con ✓, «Venta guardada», el total, «Ver comprobante PDF» y «Otra venta». Los textos anteriores «Ver comprobante» y «Nueva venta» cambian a estos.
  - **Ventas:** `Encabezado` con «+ Nueva venta» y filas como las de «Para no olvidar».
  - Los canales siguen siendo 5 aunque el mockup junte «Instagram/TikTok», porque la spec los cuenta por separado en las estadísticas.

- [ ] **Step 1: Write the failing tests** (y actualiza los textos de `Vender.test.tsx` y `Ventas.test.tsx`).
  - `test("tres pasos numerados")`: los encabezados «¿Qué vendiste?», «¿Por dónde te compró?» y «¿Cómo te pagó?».
  - `test("la tarjeta elegida muestra la cantidad")`: con 2 tocadas, el texto «2» dentro del botón del producto.
  - `test("franja con total y cliente de mostrador")`.
  - `test("descuento y fecha están en Más opciones")`: no se ven hasta tocar «Más opciones».
  - `test("confirmación con Ver comprobante PDF y Otra venta")`.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run every frontend check.** En el navegador, a 390 y 360 px, se hace una venta completa y se comprueba que el último producto se puede tocar por encima de la franja.
- [ ] **Step 5: Commit** «Venta rápida como en los mockups: tres pasos, franja fija y confirmación».

---

### Tarea 7: Revisión visual completa y versión 0.3.0

**Files:**
- Modify: `frontend/package.json`, `package-lock.json` y `backend/app/version.py` solo si la versión no es ya 0.3.0. El diseño sale en la misma 0.3.0 que la venta rápida, que aún no se publicó.

- [ ] **Step 1: Recorrido en el navegador** con datos de prueba: inicio de sesión, Inicio, Inventario (las dos pestañas y una ficha), Vender, venta guardada y Ventas.
  - Cada pantalla se mira a 1440, 390 y 360 px, en modo claro y en modo oscuro, junto al mockup que le corresponde.
  - Expected: sin desplazamiento horizontal, sin textos encimados y con contraste legible en oscuro.
- [ ] **Step 2: Corrige lo que encuentres**, con prueba si cambia el comportamiento.
- [ ] **Step 3: Corre todas las verificaciones.** `cd backend && uv run pytest -q && uv run ruff check .` y `cd frontend && npx vitest run && npx tsc -b && npm run lint && npm run build`.
  Expected: todo pasa.
- [ ] **Step 4: Commit** «Revisión visual completa del diseño».
