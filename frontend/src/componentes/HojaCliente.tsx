import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ErrorApi, pedir } from "../api";
import type { ClienteResumen } from "../clientes";
import { telefono } from "../formato";
import { sinTildes } from "../ventas";
import { Avatar } from "./FichaCliente";
import FormularioCliente from "./FormularioCliente";
import { IconoBuscar, IconoCerrar, IconoListo, IconoPersona, IconoSumar } from "./iconos";

// «¿A quién le vendiste?» de docs/mockups/fuentes/cuentas-celular.html: hoja desde abajo en el
// celular y ventana centrada en la Mac.

function Fila({ elegida, onClick, icono, nombre, detalle }: { elegida: boolean; onClick: () => void; icono: React.ReactNode; nombre: string; detalle: string }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border-2 bg-superficie px-3 py-2.5 text-left text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${elegida ? "border-rosa" : "border-borde"}`}
    >
      {icono}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[15px] font-extrabold">{nombre}</span>
        <span className="truncate text-[13px] text-suave">{detalle}</span>
      </span>
      {elegida && (
        <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-rosa text-white">
          <IconoListo tamano={14} />
        </span>
      )}
    </button>
  );
}

export default function HojaCliente({
  elegida,
  alElegir,
  alCerrar,
}: {
  elegida: ClienteResumen | null;
  alElegir: (c: ClienteResumen | null) => void;
  alCerrar: () => void;
}) {
  const [lista, setLista] = useState<ClienteResumen[]>([]);
  const [buscar, setBuscar] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const hoja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pedir<ClienteResumen[]>("/api/clientes")
      .then(setLista)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
    hoja.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, []);

  // Foco atrapado dentro de la hoja y Escape para cerrar.
  function teclas(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      return alCerrar();
    }
    if (e.key !== "Tab" || !hoja.current) return;
    const enfocables = [...hoja.current.querySelectorAll<HTMLElement>("button, input, a[href]")].filter((el) => !el.hasAttribute("disabled"));
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  const texto = sinTildes(buscar.trim());
  const digitos = buscar.replace(/\D/g, "");
  const visibles = lista.filter(
    (c) => !texto || sinTildes(c.nombre).includes(texto) || (digitos !== "" && c.whatsapp.includes(digitos)),
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(60,20,40,0.35)] md:items-center md:p-6" onClick={alCerrar}>
      <div
        ref={hoja}
        role="dialog"
        aria-modal="true"
        aria-label="¿A quién le vendiste?"
        onKeyDown={teclas}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col gap-3.5 overflow-y-auto rounded-t-[32px] bg-superficie px-5 pt-6 pb-[max(26px,env(safe-area-inset-bottom))] md:max-w-[480px] md:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-titulo text-[26px] font-semibold">{creando ? "Nueva clienta" : "¿A quién le vendiste?"}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media focus-visible:outline-2 focus-visible:outline-rosa"
          >
            <IconoCerrar tamano={18} />
          </button>
        </div>

        {creando ? (
          <FormularioCliente soloBasico alCancelar={() => setCreando(false)} alGuardar={(c) => alElegir(c)} />
        ) : (
          <>
            <label className="flex h-[52px] shrink-0 items-center gap-2.5 rounded-2xl border-[1.5px] border-borde-campo bg-superficie px-[18px] text-suave focus-within:border-rosa">
              <IconoBuscar tamano={18} />
              <span className="sr-only">Buscar clienta</span>
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar clienta"
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-tinta outline-none"
              />
            </label>
            {error && <p role="alert" className="text-sm font-bold text-error">{error}</p>}
            <div className="flex flex-col gap-2">
              {!texto && (
                <Fila
                  elegida={elegida === null}
                  onClick={() => alElegir(null)}
                  icono={
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rosa-claro text-rosa-activo">
                      <IconoPersona tamano={20} trazo={1.8} />
                    </span>
                  }
                  nombre="Cliente de mostrador"
                  detalle="Para ferias y ventas sin datos"
                />
              )}
              {visibles.map((c) => (
                <Fila key={c.id} elegida={elegida?.id === c.id} onClick={() => alElegir(c)} icono={<Avatar nombre={c.nombre} chico />} nombre={c.nombre} detalle={telefono(c.whatsapp)} />
              ))}
              {texto && visibles.length === 0 && <p className="px-1 py-2 text-sm text-suave">{`Ninguna clienta coincide con «${buscar.trim()}».`}</p>}
            </div>
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-rosa-palo bg-superficie text-base font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa"
            >
              <IconoSumar tamano={18} />
              Nueva clienta
            </button>
          </>
        )}
      </div>
    </div>
  );
}
