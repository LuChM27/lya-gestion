import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import { Campo, MensajeError } from "../componentes/Formulario";
import { IconoEditar, IconoVolver } from "../componentes/iconos";
import { Pastillas } from "../componentes/ui";
import { leerPesos, type Categoria, type GastoFijo } from "../dinero";
import { pesos } from "../formato";
import { recordado, recordar, type Cuenta } from "../ventas";

// Registrar gasto: tercera pantalla de docs/mockups/fuentes/cuentas-celular.html, a pantalla
// completa en el celular como la venta rápida.

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-base font-extrabold">
        <span className="text-rosa">{numero}.</span> {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function Gasto() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const fijo = parametros.get("fijo");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [conNota, setConNota] = useState(false);
  const [nota, setNota] = useState("");
  const [gastoFijo, setGastoFijo] = useState<GastoFijo | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([pedir<Cuenta[]>("/api/cuentas"), pedir<Categoria[]>("/api/categorias?tipo=gasto"), fijo ? pedir<GastoFijo[]>("/api/gastos-fijos") : Promise.resolve([])])
      .then(([lista, cats, fijos]) => {
        setCuentas(lista);
        setCategorias(cats);
        const guardada = recordado("gasto.cuenta");
        setCuenta(lista.some((c) => String(c.id) === guardada) ? guardada! : String(lista[0]?.id ?? ""));
        const f = fijos.find((x) => String(x.id) === fijo);
        if (f) {
          setGastoFijo(f);
          setMonto(pesos(f.monto));
          setCategoria(String(f.categoria_id));
          if (f.cuenta_id) setCuenta(String(f.cuenta_id));
        }
      })
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [fijo]);

  const valor = leerPesos(monto);
  const listo = valor !== null && valor > 0;
  const nombreCategoria = categorias.find((c) => String(c.id) === categoria)?.nombre;
  const nombreCuenta = cuentas.find((c) => String(c.id) === cuenta)?.nombre;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !listo) return;
    if (!categoria) return setError("Elige en qué se fue el dinero.");
    if (!cuenta) return setError("Elige de dónde salió.");
    setEnviando(true);
    try {
      await enviar("/api/movimientos", {
        tipo: "gasto",
        monto: valor,
        categoria_id: Number(categoria),
        cuenta_id: Number(cuenta),
        cuenta_destino_id: null,
        fecha: null,
        nota: nota.trim() || null,
        gasto_fijo_id: gastoFijo?.id ?? null,
      });
      recordar("gasto.cuenta", cuenta);
      navegar("/cuentas");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px] pb-[calc(170px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="flex h-12 items-center gap-3">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => {
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (idx > 0) navegar(-1);
            else navegar("/cuentas");
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media focus-visible:outline-2 focus-visible:outline-rosa"
        >
          <IconoVolver />
        </button>
        <h1 className="font-titulo text-[26px] font-semibold">{gastoFijo ? gastoFijo.nombre : "Registrar gasto"}</h1>
      </header>

      <label className="flex flex-col items-center gap-1 rounded-3xl border border-borde bg-superficie p-4">
        <span className="text-sm font-extrabold text-suave">¿Cuánto?</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="$ 0"
          value={monto}
          onChange={(e) => (setMonto(e.target.value), setError(""))}
          onBlur={() => listo && setMonto(pesos(valor))}
          className="w-full border-0 bg-transparent text-center text-[40px] font-extrabold tracking-[-0.01em] text-tinta outline-none placeholder:text-borde-campo"
        />
      </label>

      <Paso numero={1} titulo="¿En qué?">
        <Pastillas etiqueta="¿En qué?" opciones={categorias.map((c) => [String(c.id), c.nombre] as const)} valor={categoria} alElegir={(v) => (setCategoria(v), setError(""))} />
      </Paso>
      <Paso numero={2} titulo="¿De dónde salió?">
        <Pastillas etiqueta="¿De dónde salió?" opciones={cuentas.map((c) => [String(c.id), c.nombre] as const)} valor={cuenta} alElegir={(v) => (setCuenta(v), setError(""))} />
      </Paso>
      {conNota && <Campo etiqueta="Nota" required={false} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} autoFocus />}

      <section
        aria-label="Total"
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-[28px] bg-superficie px-5 pt-4 pb-[max(22px,env(safe-area-inset-bottom))] shadow-franja md:sticky md:bottom-4 md:rounded-[28px] md:pb-5"
      >
        <MensajeError texto={error} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-bold text-suave">{nombreCategoria ? `${nombreCategoria} · ${nombreCuenta ?? ""}` : "Elige en qué se fue"}</span>
            <span className="text-[26px] font-extrabold tracking-[-0.01em]">{pesos(listo ? valor : 0)}</span>
          </div>
          {!conNota && (
            <button
              type="button"
              onClick={() => setConNota(true)}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-rosa-claro px-3 py-2 text-[13px] font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
            >
              <IconoEditar tamano={16} trazo={2} />
              Agregar nota
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!listo || enviando}
          className={`h-14 rounded-full text-[17px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${listo ? "bg-rosa text-white shadow-boton-grande" : "bg-borde text-apagado"}`}
        >
          {listo ? "Guardar gasto" : "Escribe el monto"}
        </button>
      </section>
    </form>
  );
}
