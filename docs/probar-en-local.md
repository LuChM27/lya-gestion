# Probar L&A Gestión en tu computador

Esta guía sirve para ver y probar la app mientras se desarrolla, sin instalarla en la Mac de ella. Necesitas tener instalados [uv](https://docs.astral.sh/uv/) y Node.js.

## 1. Arrancar el backend

En una terminal:

```powershell
cd C:\Proyecto\lya\backend
uv run python -m app
```

- Queda corriendo en el puerto 8080.
- Los datos de prueba se guardan en `backend\datos-dev` y los respaldos en `backend\respaldos-dev`. Están fuera de git y no tocan ningún dato real.
- Para empezar de cero, apaga el backend y borra esas dos carpetas.

## 2. Arrancar la interfaz

En una segunda terminal:

```powershell
cd C:\Proyecto\lya\frontend
npm install   # solo la primera vez o cuando cambien las dependencias
npm run dev
```

## 3. Abrir la app

Abre `http://localhost:5173` en el navegador.

- **La primera vez** te pide crear una cuenta. Pon cualquier usuario y contraseña, y anota el código de 8 dígitos que aparece: sirve para recuperar el acceso.
- **Para tener algo que vender:**
  1. En **Inventario**, toca «Nuevo modelo».
  2. En la ficha del modelo, agrega una variante (un color).
  3. En la variante, toca «Sumar a vitrina».
- **Para vender**, usa el «+» de la barra del celular o «Nueva venta». Después de guardar puedes abrir el comprobante en PDF y anular la venta desde su detalle.

## Verla como en el celular

**En el computador:**
1. Presiona F12 para abrir las herramientas de desarrollador.
2. Presiona Ctrl+Shift+M y elige un iPhone, o pon 390 de ancho. Revisa también 360.

**En tu celular, conectado al mismo Wi-Fi:**
1. Arranca la interfaz con `npm run dev -- --host`.
2. Abre en el celular la dirección «Network» que muestra la terminal, por ejemplo `http://192.168.1.20:5173`.
3. Si Windows pregunta por el firewall, permite el acceso en redes privadas.

## Compararla con el diseño

- Abre `docs\mockups\mockups.html` con doble clic: muestra las seis pantallas de referencia.
- Los estilos exactos de cada pantalla están en `docs\mockups\fuentes\`.

## Apagar

Presiona Ctrl+C en cada terminal.

## Pruebas automáticas

```powershell
cd C:\Proyecto\lya\backend
uv run pytest -q

cd C:\Proyecto\lya\frontend
npx vitest run
```
