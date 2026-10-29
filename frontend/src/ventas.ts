// Tipos de la venta rápida, tal como los devuelve /api/ventas.

export type CatalogoItem = {
  variante_id: number;
  modelo_id: number;
  nombre: string;
  color: string;
  sku: string;
  foto: string | null;
  categoria: string;
  precio: number;
  existencia: number;
};

export type Cuenta = { id: number; nombre: string };

export type ItemVenta = {
  variante_id: number;
  modelo: string;
  color: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type Venta = {
  id: number;
  numero: string;
  fecha: string;
  canal: string;
  estado: string;
  cliente: string;
  cuenta: Cuenta | null;
  items: ItemVenta[];
  subtotal: number;
  descuento: number;
  total: number;
  comprobante: string;
};

export type DiaVentas = { dia: string; ventas: Venta[]; total: number; cantidad: number };

export const CANALES = [
  ["presencial", "Presencial"],
  ["feria", "Feria"],
  ["instagram", "Instagram"],
  ["whatsapp", "WhatsApp"],
  ["tiktok", "TikTok"],
] as const;

export const nombreCanal = (canal: string) => CANALES.find(([valor]) => valor === canal)?.[1] ?? canal;

/** Recuerda una preferencia en este dispositivo; si el navegador no deja, no pasa nada. */
export function recordar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // modo privado o almacenamiento bloqueado
  }
}

export function recordado(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** Fecha de hoy en Bogotá como AAAA-MM-DD, el formato de <input type="date">. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
