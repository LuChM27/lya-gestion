import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { actualizar, borrar, enviar, ErrorApi, pedir } from "../api";
import { BotonSecundario, MensajeError } from "../componentes/Formulario";
import { IconoVolver } from "../componentes/iconos";
import { Encabezado } from "../componentes/ui";
import type { Categoria } from "../dinero";

// Categorías de Mis cuentas, con las piezas de docs/mockups/fuentes/cuentas-mac.html.
const CAMPO =
  "h-11 min-w-0 flex-1 rounded-2xl border-[1.5px] border-borde-campo bg-superficie px-4 text-[15px] text-tinta outline-none focus:border-2 focus:border-rosa";
const CHICO =
  "inline-flex h-11 items-center rounded-full border-[1.5px] border-rosa-palo bg-superficie px-4 text-sm font-extrabold whitespace-nowrap text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa";
const PRINCIPAL_CHICO =
  "inline-flex h-11 items-center rounded-full bg-rosa px-4 text-sm font-extrabold whitespace-nowrap text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60";

function Fila({ c, alCambiar }: { c: Categoria; alCambiar: () => void }) {
  const [modo, setModo] = useState<"ver" | "renombrar" | "archivar">("ver");
  const [nombre, setNombre] = useState(c.nombre);
  const [error, setError] = useState("");

  async function hacer(accion: () => Promise<unknown>) {
    try {
      await accion();
      setModo("ver");
      alCambiar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  return (
    <li className="flex flex-col gap-2 border-t border-borde py-3">
      {modo === "renombrar" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim()) hacer(() => actualizar(`/api/categorias/${c.id}`, { nombre: nombre.trim() }));
          }}
        >
          <input aria-label={`Nuevo nombre de ${c.nombre}`} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={CAMPO} />
          <button type="submit" className={PRINCIPAL_CHICO}>
            Guardar
          </button>
          <button type="button" onClick={() => setModo("ver")} className={CHICO}>
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 text-[15px] font-bold">{c.nombre}</span>
          {c.protegida ? (
            <span className="text-xs font-bold text-suave">La usa la app</span>
          ) : (
            modo === "ver" && (
              <>
                <button type="button" aria-label={`Renombrar ${c.nombre}`} onClick={() => setModo("renombrar")} className={CHICO}>
                  Renombrar
                </button>
                <button type="button" aria-label={`Archivar ${c.nombre}`} onClick={() => setModo("archivar")} className={CHICO}>
                  Archivar
                </button>
              </>
            )
          )}
        </div>
      )}
      {modo === "archivar" && (
        <div className="rounded-[22px] bg-peligro-fondo p-4">
          <p className="mb-3 text-sm font-bold">{`¿Archivar ${c.nombre}? Sus movimientos se conservan.`}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => hacer(() => borrar(`/api/categorias/${c.id}`))} className="h-11 rounded-full bg-peligro px-5 text-[15px] font-extrabold text-sobre-peligro">
              Archivar
            </button>
            <BotonSecundario onClick={() => setModo("ver")}>Cancelar</BotonSecundario>
          </div>
        </div>
      )}
      <MensajeError texto={error} />
    </li>
  );
}

function Grupo({ titulo, tipo, categorias, alCambiar }: { titulo: string; tipo: "gasto" | "ingreso"; categorias: Categoria[]; alCambiar: () => void }) {
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !nueva.trim()) return;
    setEnviando(true);
    try {
      await enviar("/api/categorias", { nombre: nueva.trim(), tipo });
      setNueva("");
      alCambiar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-1 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6">
      <h2 className="pb-2 text-[17px] font-extrabold md:text-[19px]">{titulo}</h2>
      <ul>
        {categorias.map((c) => (
          <Fila key={c.id} c={c} alCambiar={alCambiar} />
        ))}
      </ul>
      <form onSubmit={agregar} className="flex flex-wrap items-center gap-2 border-t border-borde pt-3">
        <input
          aria-label={`Nueva categoría de ${tipo}`}
          placeholder={tipo === "gasto" ? "Por ejemplo, Clases" : "Por ejemplo, Talleres"}
          value={nueva}
          onChange={(e) => (setNueva(e.target.value), setError(""))}
          maxLength={60}
          className={CAMPO}
        />
        <button type="submit" disabled={enviando} className={PRINCIPAL_CHICO}>
          Agregar
        </button>
      </form>
      <MensajeError texto={error} />
    </section>
  );
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    pedir<Categoria[]>("/api/categorias").then(setCategorias, (err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [version]);

  const [archivadas, setArchivadas] = useState<Categoria[] | null>(null);
  const recargar = () => setVersion((v) => v + 1);

  async function verArchivadas() {
    if (archivadas) return setArchivadas(null);
    try {
      setArchivadas(await pedir<Categoria[]>("/api/categorias?archivadas=true"));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  async function recuperar(c: Categoria) {
    try {
      await enviar(`/api/categorias/${c.id}/restaurar`, {});
      setArchivadas((lista) => lista?.filter((x) => x.id !== c.id) ?? null);
      recargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/cuentas" className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline">
        <IconoVolver tamano={18} />
        Volver a Mis cuentas
      </Link>
      <Encabezado titulo="Categorías" subtitulo="Ventas, Insumos y Retiro personal las usa la app y no se cambian." />
      {error && (
        <p role="alert" className="font-bold text-error">
          {error}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Grupo titulo="Gastos" tipo="gasto" categorias={categorias.filter((c) => c.tipo === "gasto")} alCambiar={recargar} />
        <Grupo titulo="Ingresos" tipo="ingreso" categorias={categorias.filter((c) => c.tipo === "ingreso")} alCambiar={recargar} />
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={verArchivadas} className="min-h-11 self-start text-sm font-extrabold text-rosa-oscuro">
          {archivadas ? "Ocultar archivadas" : "Ver archivadas"}
        </button>
        {archivadas?.length === 0 && <p className="text-sm text-suave">No tienes categorías archivadas.</p>}
        {archivadas?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-[18px] border border-borde bg-superficie px-3.5 py-2">
            <span className="flex-1 text-[15px] font-bold">{c.nombre}</span>
            <button type="button" aria-label={`Recuperar ${c.nombre}`} onClick={() => recuperar(c)} className={CHICO}>
              Recuperar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
