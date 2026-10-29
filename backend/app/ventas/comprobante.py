"""Comprobante de venta en PDF: se arma en memoria en cada petición y nunca se guarda."""

import io
from datetime import UTC
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.auth.dependencias import usuario_actual
from app.db import SesionDB
from app.hora import BOGOTA
from app.ventas.esquemas import VentaSalida
from app.ventas.modelos import Pedido
from app.ventas.ventas import venta_salida

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])

NEGOCIO = "L&A Tejidos"
ROSA = colors.HexColor("#D9487E")
ROSA_PALO = colors.HexColor("#E8AFCB")
DORADO = colors.HexColor("#C9A227")
ROJO = colors.HexColor("#B3261E")
TINTA = colors.HexColor("#1F1A1D")
CANALES = {
    "instagram": "Instagram",
    "tiktok": "TikTok",
    "whatsapp": "WhatsApp",
    "feria": "Feria",
    "presencial": "Presencial",
}

TEXTO = ParagraphStyle("texto", fontName="Helvetica", fontSize=11, leading=15, textColor=TINTA)
TITULO = ParagraphStyle("titulo", parent=TEXTO, fontName="Helvetica-Bold", fontSize=16, leading=22)
ANULADA = ParagraphStyle(
    "anulada", parent=TEXTO, fontName="Helvetica-Bold", fontSize=30, leading=38, textColor=ROJO
)
PIE = ParagraphStyle("pie", parent=TEXTO, fontSize=9, leading=12, textColor=colors.gray)


def pesos(n: int) -> str:
    return "$ " + f"{n:,}".replace(",", ".")


def _encabezado(lienzo, documento) -> None:
    ancho, alto = documento.pagesize
    lienzo.saveState()
    lienzo.setFillColor(ROSA)
    lienzo.rect(0, alto - 2.4 * cm, ancho, 2.4 * cm, fill=1, stroke=0)
    lienzo.setFillColor(colors.white)
    lienzo.setFont("Helvetica-Bold", 22)
    lienzo.drawString(2 * cm, alto - 1.55 * cm, NEGOCIO)
    lienzo.restoreState()


def comprobante_pdf(venta: VentaSalida) -> bytes:
    salida = io.BytesIO()
    documento = SimpleDocTemplate(
        salida,
        pagesize=letter,
        topMargin=3.4 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        title=f"Comprobante de venta N.º {venta.numero}",
        author=NEGOCIO,
    )
    fecha = venta.fecha.replace(tzinfo=UTC).astimezone(BOGOTA)
    historia = [
        Paragraph(f"Comprobante de venta N.º {venta.numero}", TITULO),
        Paragraph(f"Fecha: {fecha:%d/%m/%Y}", TEXTO),
        Paragraph(f"Cliente: {escape(venta.cliente)}", TEXTO),
        Paragraph(f"Canal: {CANALES.get(venta.canal, venta.canal)}", TEXTO),
        Spacer(1, 0.4 * cm),
    ]
    if venta.estado == "cancelado":
        historia += [Paragraph("ANULADA", ANULADA), Spacer(1, 0.2 * cm)]

    filas = [["Producto", "Cant.", "Precio", "Subtotal"]] + [
        [
            Paragraph(escape(f"{i.modelo} · {i.color}"), TEXTO),
            str(i.cantidad),
            pesos(i.precio_unitario),
            pesos(i.subtotal),
        ]
        for i in venta.items
    ]
    tabla = Table(filas, colWidths=[8.6 * cm, 2 * cm, 3.4 * cm, 3.6 * cm], repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 11),
                ("FONT", (0, 1), (-1, -1), "Helvetica", 11),
                ("BACKGROUND", (0, 0), (-1, 0), ROSA_PALO),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, ROSA_PALO),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    historia += [tabla, Spacer(1, 0.4 * cm)]

    totales = [["Subtotal", pesos(venta.subtotal)]]
    if venta.descuento > 0:
        totales.append(["Descuento", "- " + pesos(venta.descuento)])
    totales.append(["Total", pesos(venta.total)])
    resumen = Table(totales, colWidths=[13.6 * cm, 4 * cm])
    resumen.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 11),
                ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 14),
                ("TEXTCOLOR", (0, -1), (-1, -1), DORADO),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("TOPPADDING", (0, -1), (-1, -1), 8),
            ]
        )
    )
    historia.append(resumen)
    if venta.cuenta is not None:
        historia += [
            Spacer(1, 0.3 * cm),
            Paragraph(f"Pagado con {escape(venta.cuenta.nombre)}", TEXTO),
        ]
    historia += [
        Spacer(1, 1 * cm),
        Paragraph("Gracias por tu compra.", TEXTO),
        Paragraph("Este comprobante no es una factura.", PIE),
    ]
    documento.build(historia, onFirstPage=_encabezado, onLaterPages=_encabezado)
    return salida.getvalue()


# El parámetro ?v= solo cambia la dirección para que Safari no reutilice un PDF viejo.
@router.get("/pedidos/{pedido_id}/comprobante.pdf")
def comprobante(pedido_id: int, sesion: SesionDB) -> Response:
    pedido = sesion.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(404, "Esa venta no existe.")
    venta = venta_salida(sesion, pedido)
    return Response(
        comprobante_pdf(venta),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="comprobante-{venta.numero}.pdf"'},
    )
