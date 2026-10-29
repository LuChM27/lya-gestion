import { vi } from "vitest";

type Respuesta = { estado?: number; cuerpo?: unknown };

/** Reemplaza fetch con respuestas fijas por "MÉTODO /ruta". */
export function simularApi(rutas: Record<string, Respuesta>) {
  const llamadas: { clave: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opciones: RequestInit = {}) => {
      const clave = `${opciones.method ?? "GET"} ${url}`;
      llamadas.push({ clave, cuerpo: opciones.body ? JSON.parse(String(opciones.body)) : null });
      const r = rutas[clave] ?? { estado: 404, cuerpo: { detail: "No encontrado" } };
      const estado = r.estado ?? 200;
      return new Response(estado === 204 ? null : JSON.stringify(r.cuerpo ?? {}), {
        status: estado,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return llamadas;
}
