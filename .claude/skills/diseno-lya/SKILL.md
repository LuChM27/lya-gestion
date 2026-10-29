---
name: diseno-lya
description: Use before creating, changing, planning or reviewing any screen, component, style or copy in frontend/ of L&A Gestión — every screen must match the reference mockups in docs/mockups/mockups.html (Fraunces titles, Nunito text, rosa palette, pill buttons, sidebar with logo, phone bottom bar with central «+»).
---

# Diseño de L&A Gestión

Las pantallas de referencia están en `docs/mockups/mockups.html` (índice en `docs/mockups/README.md`):
- Inicio, Inventario, Pedidos e Inicio de sesión en Mac (1440 px).
- Inicio y Venta rápida en celular (390 px).

Toda pantalla nueva o modificada se ve como ellas. Si una pantalla no tiene mockup, se arma con las mismas piezas de esta guía.

## Antes de escribir código

1. **Abre los mockups y míralos.** El HTML pesa 2,3 MB y no se lee como texto.
   - Sírvelos con `cd docs/mockups && python -m http.server 8765 --bind 127.0.0.1` y ábrelos en el navegador en `http://127.0.0.1:8765/mockups.html`.
   - Cada pantalla es un `<iframe>` del mismo origen: con `contentDocument` puedes leer estilos calculados.
2. **En un plan:** cada tarea de interfaz dice qué mockup sigue.
3. **Al terminar:** compara tu pantalla con el mockup en el navegador, a 1440 px y a 390 px. Revisa también 360 px, sin desplazamiento horizontal.

## Valores (sacados de los mockups)

**Letras.** Ambas van incluidas con `@fontsource`; nada de Google Fonts ni CDN.
- **Títulos:** Fraunces 600.
  - En Mac: 40 px.
  - En celular: 30 px para el saludo y 26 px para el título de pantalla.
  - «L&A» del encabezado: 24 px, cursiva.
- **Texto:** Nunito. Etiquetas de sección y botones van en 800; el texto normal en 400–700.
- **Tamaños de Nunito:** 12, 13, 14, 15, 16, 18 y 20 px. Las cifras grandes van en 34–40 px, 800.

**Colores.**

| Uso | Hex |
|---|---|
| Fondo de pantalla | `#FFF8FB` |
| Tarjetas | `#FFFFFF`, borde `#F6E6EE` (o `#F1DCE6`) |
| Rosa principal, botones | `#D9487E` |
| Rosa de textos de acción y enlaces | `#B83467` |
| Rosa claro, chips y menú activo | `#FBEAF2` |
| Rosa palo, panel del login y menú lateral | `#E8AFCB` / `#EBA5C6` |
| Texto | `#1F1A1D` |
| Texto secundario | `#6E5F67` |
| Texto medio | `#4A3D44` |
| «En stock» y positivos | texto `#2E7D67` sobre `#E3F5EF` |
| «Por agotarse» | texto `#8A6A0A` sobre `#FBF3DC` |
| «Bajo mínimo» | texto `#B42345` sobre `#FCE4EA` |
| Lila, fondo de cristal | `#EFE8F6`, acento `#5B4A7A` |
| Dorado, totales | `#C9A227` |
| Opción elegida en pastillas | fondo `#1F1A1D`, texto blanco |

Fondo de la foto que falta, según categoría: crochet `#FBEAF2`, murano `#E3F5EF`, cristal `#EFE8F6`, otro `#FBF3DC`. Encima va el ícono de bolso del color del acento.

**Formas.**
- **Botones y pastillas:** totalmente redondos (`999px`). El botón principal es rosa con sombra `0 10px 24px rgba(217,72,126,.28)`.
- **Tarjetas:** radio de 20–28 px y sombra suave `0 8px 24px rgba(217,72,126,.07)`. La tarjeta elegida lleva borde de 1,6 px `#D9487E` y sombra `0 8px 20px rgba(217,72,126,.18)`.
- **Íconos:** de línea, estilo Lucide (`lucide-react`), trazo de unos 1,8 px.
- **Celular:** botones de al menos 44 px de alto.

## Estructura

- **Mac:**
  - **Menú lateral rosa claro:**
    - Logo redondo arriba.
    - Secciones con ícono, en este orden: Inicio, Ventas, Pedidos, Inventario, Clientes, Mis cuentas, Estadísticas, Calendario.
    - Solo se muestran las que ya existen.
    - La sección activa va en una pastilla blanca, con texto rosa.
    - Abajo, la tarjeta «Entrar desde el celular».
  - **Encabezado de cada pantalla:**
    - Fecha pequeña («Sábado, 24 de octubre»).
    - Título en Fraunces.
    - Subtítulo en texto secundario.
    - A la derecha, las acciones; la principal es «+ Nueva venta» o «+ Nuevo modelo».
- **Celular:**
  - **Encabezado:** logo pequeño y «L&A» en Fraunces cursiva.
  - **Barra inferior:** Inicio · Pedidos · «+» rosa grande en el centro, que abre la venta rápida · Inventario · Más.
    - Mientras no exista Pedidos, va Ventas en su lugar.
    - Cada ícono lleva su texto debajo.
  - **Venta rápida:**
    - Va a pantalla completa, sin barra inferior, con botón de volver.
    - Tres pasos numerados en rosa:
      1. ¿Qué vendiste?
      2. ¿Por dónde te compró?
      3. ¿Cómo te pagó?
    - Franja fija abajo: «N productos», total grande, chip «Cliente de mostrador» y botón «Guardar venta».
- **Inventario:**
  - **Pestañas en pastilla:** Productos en vitrina / Insumos / En producción. «En producción» aparece cuando exista la producción.
  - **Filtros por categoría en pastillas.**
  - **Tarjetas de modelo:**
    - Foto o color de categoría, con la etiqueta de estado arriba a la derecha.
    - Categoría en mayúsculas pequeñas.
    - Nombre, «N en vitrina» y precio.
- **Inicio de sesión:**
  - **Mac:** panel izquierdo rosa palo con el logo grande y «Bolsos y accesorios hechos a mano, con todo en orden.».
  - **Derecha:** «¡Qué bueno verte!» y el formulario. Debajo, un recuadro rosa claro con «¿Olvidaste tu contraseña?» y «Recuperar acceso».

## Textos

- Español de Colombia y tuteo: «¿Qué vendiste?», «¡Hola de nuevo!».
- Botones que empiezan por verbo: «Guardar venta», «Nuevo modelo», «Ver comprobante PDF», «Otra venta».
- Montos `$ 125.000` y fechas `DD/MM/AAAA` o «Sábado, 24 de octubre».

## Modo oscuro

- Los mockups son claros.
- El modo oscuro usa los mismos tokens redefinidos en `frontend/src/tema.css`.
- Revisa el contraste de cada color nuevo en los dos modos.
