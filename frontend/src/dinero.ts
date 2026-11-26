// Tipos de Mis cuentas y compras, y lectura de montos en pesos.
import { leerNumero, pesos } from "./formato";
import { hoyBogota } from "./ventas";

export type CuentaSaldo = { id: number; nombre: string; saldo_inicial: number; saldo: number; activa: boolean };
export type Categoria = { id: number; nombre: string; tipo: "ingreso" | "gasto" | "retiro"; activa: boolean; protegida: boolean };
export type TipoMovimiento = "gasto" | "ingreso" | "retiro" | "transferencia";

export type Movimiento = {
  id: number;
  fecha: string;
  tipo: "ingreso" | "egreso" | "transferencia";
  descripcion: string;
  categoria: string | null;
  cuenta: string;
  cuenta_destino: string | null;
  monto: number;
  signo: "+" | "-" | "=";
  editable: boolean;
  origen: { tipo: "venta" | "compra"; id: number; numero: string } | null;
};

export type GastoFijo = {
  id: number;
  nombre: string;
  monto: number;
  categoria_id: number;
  categoria: string;
  cuenta_id: number | null;
  cuenta: string | null;
  activo: boolean;
  registrado_este_mes: boolean;
};

export type ResumenMes = {
  mes: string;
  entro: number;
  salio: number;
  ganancia: number;
  retiros: number;
  por_categoria: { categoria: string; monto: number }[];
  saldos_al_cierre: { cuenta: string; saldo: number }[];
};

export type ItemCompra = { insumo_id: number; insumo: string; cantidad: number; unidad: string; precio_unitario: number; subtotal: number };

export type Compra = {
  id: number;
  numero: string;
  fecha: string;
  proveedor: string | null;
  total: number;
  estado: "activa" | "anulada";
  nota: string | null;
  cuenta: { id: number; nombre: string } | null;
  pagada_el: string | null;
  items: ItemCompra[];
};

/** Monto en pesos enteros: «$ 150.000», «150.000» o «150000». Con decimales o letras, null. */
export function leerPesos(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = leerNumero(texto);
  return n !== null && Number.isInteger(n) ? n : null;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const mesActual = () => hoyBogota().slice(0, 7);
export const nombreMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];

function moverMes(mes: string, delta: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export const mesAnterior = (mes: string) => moverMes(mes, -1);
export const mesSiguiente = (mes: string) => moverMes(mes, 1);

/** Último día del mes como DD/MM/AAAA, para «Saldo al 30/11/2026». */
export function ultimoDia(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const dia = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return `${String(dia).padStart(2, "0")}/${String(numero).padStart(2, "0")}/${anio}`;
}

/** Saldo con signo antes del peso: «-$ 20.000». */
export const saldo = (n: number) => (n < 0 ? `-${pesos(-n)}` : pesos(n));

export const TITULOS: Record<TipoMovimiento, string> = {
  gasto: "Registrar gasto",
  ingreso: "Otro ingreso",
  retiro: "Retiro personal",
  transferencia: "Transferir",
};
export const MONTO_INVALIDO = "Escribe el monto en pesos, por ejemplo 150.000.";
