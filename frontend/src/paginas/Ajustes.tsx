import { useCallback, useEffect, useState } from "react";
import { ErrorApi, enviar, pedir } from "../api";
import Confirmar from "../componentes/Confirmar";
import { BotonPrincipal, Encabezado } from "../componentes/ui";
import { fecha, hora } from "../formato";

// Sin mockup propio: se arma con las piezas de inicio-mac.html (tarjeta «Para no olvidar»,
// filas de aviso) y de Compras. Por ahora Ajustes solo tiene los respaldos.
export type Respaldo = {
  nombre: string;
  fecha: string;
  motivo: string;
  tamano: number;
};
type Respaldos = { carpeta: string; atrasado: boolean; respaldos: Respaldo[] };

const MOTIVO: Record<string, string> = {
  diario: "Automático",
  manual: "Hecho a mano",
  "antes-de-restaurar": "Antes de restaurar",
  "antes-de-actualizar": "Antes de actualizar",
};
const VISIBLES = 10;

function tamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const cuando = (r: Respaldo) => `${fecha(r.fecha)} · ${hora(r.fecha)}`;

export default function Ajustes() {
  const [datos, setDatos] = useState<Respaldos | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [respaldando, setRespaldando] = useState(false);
  const [todos, setTodos] = useState(false);

  const cargar = useCallback(() => pedir<Respaldos>("/api/respaldos").then(setDatos, (err) => setError(err instanceof ErrorApi ? err.mensaje : String(err))), []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function respaldarAhora() {
    if (respaldando) return;
    setRespaldando(true);
    setError("");
    setAviso("");
    try {
      const r = await enviar<Respaldo>("/api/respaldos", {});
      setAviso(`Listo: guardaste un respaldo del ${cuando(r)}`);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setRespaldando(false);
    }
  }

  async function restaurar(r: Respaldo) {
    await enviar<Respaldo>(`/api/respaldos/${encodeURIComponent(r.nombre)}/restaurar`, {});
    setAviso(`Listo: tus datos volvieron al ${cuando(r)} y lo que tenías antes quedó en un respaldo «Antes de restaurar».`);
    await cargar();
  }

  const lista = datos?.respaldos ?? [];
  const ultimo = lista[0];
  const visibles = todos ? lista : lista.slice(0, VISIBLES);

  return (
    <>
      <Encabezado titulo="Ajustes" subtitulo="Respaldos de tus datos" />
      {error && (
        <p role="alert" className="font-bold text-error">
          {error}
        </p>
      )}
      {datos && (
        <section
          aria-labelledby="titulo-respaldos"
          className="flex max-w-[720px] flex-col gap-4 md:rounded-[28px] md:border md:border-borde md:bg-superficie md:p-[26px] md:shadow-tarjeta"
        >
          <h2 id="titulo-respaldos" className="text-[17px] font-extrabold md:text-[19px]">
            Respaldos
          </h2>
          <div className={`flex items-center gap-3 rounded-[18px] px-3.5 py-3 ${datos.atrasado ? "bg-peligro-fondo" : "bg-ok-fondo"}`}>
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${datos.atrasado ? "bg-peligro" : "bg-ok"}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-sm font-extrabold">
                {!ultimo ? "Todavía no hay ningún respaldo" : datos.atrasado ? "El último respaldo tiene más de 2 días" : "Tus datos están respaldados"}
              </span>
              {ultimo && <span className="text-[13px] text-tinta-detalle">{`El último es del ${cuando(ultimo)}`}</span>}
            </span>
          </div>
          <p className="text-sm leading-normal text-suave">
            {"Cada noche a las 9:00 p. m. se guarda una copia de tus datos y fotos en "}
            <span className="font-bold text-tinta-media">{datos.carpeta}</span>
            {". Google Drive la sube a la nube. Se guardan los últimos 30 días y uno por mes durante un año."}
          </p>
          <div>
            <BotonPrincipal onClick={respaldarAhora} disabled={respaldando}>
              {respaldando ? "Respaldando…" : "Respaldar ahora"}
            </BotonPrincipal>
          </div>
          {aviso && (
            <p role="status" className="rounded-[18px] bg-ok-fondo px-3.5 py-3 text-sm font-bold text-ok">
              {aviso}
            </p>
          )}
          {lista.length > 0 && (
            <ul aria-label="Respaldos guardados" className="flex flex-col gap-2.5">
              {visibles.map((r) => (
                <li key={r.nombre} className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3 [&>div]:basis-full">
                  <span className="flex min-w-0 flex-1 basis-full flex-col gap-px md:basis-0">
                    <span className="text-sm font-extrabold">{cuando(r)}</span>
                    <span className="text-xs text-suave">{`${MOTIVO[r.motivo] ?? r.motivo} · ${tamano(r.tamano)}`}</span>
                  </span>
                  <a
                    href={`/api/respaldos/${encodeURIComponent(r.nombre)}`}
                    download={r.nombre}
                    className="inline-flex h-11 items-center px-2 text-sm font-extrabold text-rosa-oscuro no-underline focus-visible:outline-2 focus-visible:outline-rosa"
                  >
                    Descargar
                  </a>
                  <Confirmar
                    boton="Restaurar"
                    pregunta={`¿Volver tus datos y fotos al ${cuando(r)}? Lo que registraste después se guarda antes en otro respaldo, por si lo necesitas.`}
                    accion="Sí, restaurar"
                    alConfirmar={() => restaurar(r)}
                  />
                </li>
              ))}
            </ul>
          )}
          {!todos && lista.length > VISIBLES && (
            <button
              type="button"
              onClick={() => setTodos(true)}
              className="h-11 self-start text-sm font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa"
            >
              {`Ver todos (${lista.length})`}
            </button>
          )}
        </section>
      )}
    </>
  );
}
