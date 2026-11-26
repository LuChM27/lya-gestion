// Tipos de /api/clientes.

export type ClienteResumen = {
  id: number;
  nombre: string;
  whatsapp: string;
  instagram: string | null;
  total_comprado: number;
  activo: boolean;
};

export type CompraCliente = { id: number; numero: string; fecha: string; productos: string; total: number; estado: string };

export type ClienteFicha = ClienteResumen & {
  direccion: string | null;
  ciudad: string | null;
  correo: string | null;
  cedula: string | null;
  notas: string | null;
  enlace_whatsapp: string;
  creado: string;
  compras: number;
  por_cobrar: number;
  promedio: number;
  canal_frecuente: string | null;
  ultima_compra: string | null;
  historial: CompraCliente[];
};

/** Iniciales para el avatar: «Valentina Ríos» → «VR». */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
