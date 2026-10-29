import { vi } from "vitest";

type Respuesta = { estado?: number; cuerpo?: unknown; demoraMs?: number };

/** Reemplaza fetch con respuestas fijas por "MÉTODO /ruta". */
export function simularApi(rutas: Record<string, Respuesta>) {
  const llamadas: { clave: string; cuerpo: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opciones: RequestInit = {}) => {
      const clave = `${opciones.method ?? "GET"} ${url}`;
      const cuerpo = opciones.body instanceof FormData ? opciones.body : opciones.body ? JSON.parse(String(opciones.body)) : null;
      llamadas.push({ clave, cuerpo });
      const r = rutas[clave] ?? { estado: 404, cuerpo: { detail: "No encontrado" } };
      if (r.demoraMs) await new Promise((listo) => setTimeout(listo, r.demoraMs));
      const estado = r.estado ?? 200;
      return new Response(estado === 204 ? null : JSON.stringify(r.cuerpo ?? {}), {
        status: estado,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return llamadas;
}
