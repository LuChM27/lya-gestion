import type { EstadoStock } from "./componentes/ui";

export type Variante = {
  id: number;
  color: string;
  sku: string;
  stock_minimo: number;
  foto: string | null;
  pieza_unica: boolean;
  activo: boolean;
  existencia: number;
  estado: EstadoStock;
};

type ModeloBase = {
  id: number;
  nombre: string;
  categoria: string;
  precio_venta: number;
  foto: string | null;
  activo: boolean;
  unidades: number;
  estado: EstadoStock;
};

export type ModeloResumen = ModeloBase & { variantes: number };
export type ModeloDetalle = ModeloBase & { horas_tejido: number; variantes: Variante[] };

export type Insumo = {
  id: number;
  nombre: string;
  tipo: string;
  unidad: string;
  unidad_compra: string | null;
  factor_compra: number | null;
  stock_minimo: number;
  proveedor: string | null;
  activo: boolean;
  precio_unitario: number | null;
  existencia: number;
  estado: EstadoStock;
};

export type Movimiento = { id: number; fecha: string; tipo: string; cantidad: number; nota: string | null };

export const CATEGORIAS = [
  ["crochet", "Crochet"],
  ["murano", "Murano"],
  ["cristal", "Cristal"],
  ["otro", "Otro"],
] as const;

export const TIPOS_INSUMO = [
  ["hilo", "Hilo"],
  ["cuentas", "Cuentas"],
  ["herraje", "Herraje"],
  ["forro", "Forro"],
  ["argolla", "Argolla"],
  ["empaque", "Empaque"],
  ["otro", "Otro"],
] as const;

export const NOMBRE_MOVIMIENTO: Record<string, string> = {
  compra: "Compra",
  inicio_produccion: "Inicio de producción",
  consumo: "Consumo",
  liberacion: "Liberado",
  ingreso_vitrina: "Ingreso a vitrina",
  venta: "Venta",
  devolucion: "Devolución",
  anulacion: "Venta anulada",
  cambio: "Cambio",
  ajuste: "Ajuste por conteo",
  merma: "Merma",
};

export const ENTERAS = "Los productos se cuentan en unidades enteras.";
export const NUMERO_INVALIDO = "Escribe un número, por ejemplo 12,5.";

export const miniatura = (foto: string) => `/fotos/${foto.replace(".webp", "-300.webp")}`;
