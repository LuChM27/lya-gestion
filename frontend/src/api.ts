export class ErrorApi extends Error {
  estado: number;
  mensaje: string;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.mensaje = mensaje;
  }
}

const SIN_CONEXION = "No se pudo conectar con L&A. Revisa que la Mac esté encendida y vuelve a intentarlo.";

export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      credentials: "same-origin",
      ...opciones,
      headers: { "Content-Type": "application/json", ...opciones.headers },
    });
  } catch {
    throw new ErrorApi(0, SIN_CONEXION);
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    const detalle = typeof cuerpo.detail === "string" ? cuerpo.detail : "Algo salió mal. Vuelve a intentarlo.";
    throw new ErrorApi(respuesta.status, detalle);
  }
  return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
}

export const enviar = <T>(ruta: string, cuerpo: unknown) =>
  pedir<T>(ruta, { method: "POST", body: JSON.stringify(cuerpo) });

export const actualizar = <T>(ruta: string, cuerpo: unknown) =>
  pedir<T>(ruta, { method: "PUT", body: JSON.stringify(cuerpo) });

export const borrar = (ruta: string) => pedir<void>(ruta, { method: "DELETE" });

/** POST multipart: sin Content-Type, para que el navegador ponga el separador. */
export async function subir<T>(ruta: string, form: FormData): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new ErrorApi(0, SIN_CONEXION);
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    const detalle = typeof cuerpo.detail === "string" ? cuerpo.detail : "Algo salió mal. Vuelve a intentarlo.";
    throw new ErrorApi(respuesta.status, detalle);
  }
  return (await respuesta.json()) as T;
}
