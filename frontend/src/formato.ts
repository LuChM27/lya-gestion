// Formatos de Colombia: pesos sin decimales, coma decimal, punto de miles y fechas DD/MM/AAAA.

function agrupar(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function conDecimales(n: number, decimales: number): string {
  const signo = n < 0 ? "-" : "";
  const [entero, fraccion = ""] = Math.abs(n).toFixed(decimales).split(".");
  const sinCeros = fraccion.replace(/0+$/, "");
  return signo + agrupar(entero) + (sinCeros ? "," + sinCeros : "");
}

export function pesos(n: number): string {
  return "$ " + conDecimales(Math.round(n), 0);
}

/** Precio por unidad de insumo: con centavos solo si los tiene ($ 27,50). */
export function precio(n: number): string {
  const centavos = Math.round(n * 100) % 100;
  return centavos === 0 ? pesos(n) : "$ " + conDecimales(n, 2).replace(/,(\d)$/, ",$10");
}

export function cantidad(n: number): string {
  return conDecimales(n, 3);
}

export function unidades(n: number): string {
  return `${cantidad(n)} ${n === 1 ? "unidad" : "unidades"}`;
}

/** Lee lo que ella escribe: "12,5", "12.5", "1.200", "1.200,5" o "$ 125.000". */
export function leerNumero(texto: string): number | null {
  const limpio = texto.replace(/[$\s ]/g, "");
  let normal: string;
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(limpio) || /^-?\d+,\d+$/.test(limpio)) {
    normal = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normal = limpio.replace(/\./g, ""); // el punto seguido de 3 cifras es de miles
  } else if (/^-?(\d+|\d*\.\d+)$/.test(limpio)) {
    normal = limpio;
  } else {
    return null;
  }
  return Number(normal);
}

const FECHA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function fecha(iso: string): string {
  const partes = Object.fromEntries(FECHA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month}/${partes.year}`;
}
