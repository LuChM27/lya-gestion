<p align="center"><img src="assets/logo/logo-360.webp" alt="L&A Tejidos" width="160"></p>

# L&A Gestión

Sistema de gestión para **L&A Tejidos**: inventario de bolsos, accesorios e insumos, ventas y pedidos por encargo, clientes y cartera, flujo de caja, avisos automáticos y estadísticas.

Es una aplicación web local que corre en la MacBook Air de la dueña dentro de un único contenedor Docker y se usa desde el navegador de la Mac o desde el celular conectado al mismo Wi-Fi (`http://lya-tejidos.local:8080`). Los datos no salen de la Mac, salvo las copias de respaldo.

## Documentación

- [Arquitectura del sistema](docs/arquitectura.md) — objetivos, módulos, reglas de negocio, modelo de datos, despliegue, seguridad y decisiones ([original .docx](docs/arquitectura.docx)).
- [Mockups](docs/mockups/) — seis pantallas de referencia (Mac y celular).
- [Archivo de despliegue](deploy/docker-compose.yml) — el `docker-compose.yml` que se instala en `~/LyA`.

## Stack

| Capa | Tecnología |
|---|---|
| Interfaz | React + Vite + TypeScript, Tailwind CSS, ECharts; manifiesto web |
| API | Python 3.13 + FastAPI (Uvicorn), Pydantic |
| Datos | SQLite (WAL) + SQLAlchemy 2 + Alembic |
| Tareas | APScheduler en el mismo proceso |
| Archivos | Pillow (fotos), WeasyPrint (PDF), openpyxl (Excel) |
| Imagen | `python:3.13-slim` multietapa, `linux/arm64` y `linux/amd64`, publicada en `ghcr.io/luchm27/lya-gestion` |
| Lanzador | App de macOS en AppleScript o Platypus que llama a `docker compose` |

## Plan de trabajo

La entrega es una sola, construida en tres fases. Cada fase es un *milestone* y cada tarea un *issue*:

1. **Fase 1 · base** — inventario de variantes e insumos, venta rápida con comprobante PDF, clientes, cuentas y gastos, respaldos, instalador y acceso por celular.
2. **Fase 2 · control** — pedidos por encargo con abonos y estados, cartera, recetas y costo por modelo, órdenes de producción, avisos.
3. **Fase 3 · decisiones** — tablero de estadísticas, ferias y eventos, exportes a Excel.

## Convenciones

- Interfaz en español de Colombia; montos en pesos sin decimales (`$ 125.000`), fechas `DD/MM/AAAA`, zona horaria `America/Bogota`.
- Sin CDN: fuentes, íconos y librerías van dentro de la imagen (funciona sin internet).
- Pantallas desde 360 px de ancho, botones de al menos 44 px.
- Versiones con etiqueta semántica (`1.0.0`, `1.1.0`); nunca `latest` en producción.

## Propiedad

Código: Luciano. Datos: la dueña de L&A Tejidos.
