import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import { MensajeError } from "../componentes/Formulario";
import { IconoBuscar, IconoCerrar, IconoListo, IconoSumar } from "../componentes/iconos";
import { BotonPastilla, Encabezado, Pastillas } from "../componentes/ui";
import type { Compra } from "../dinero";
import { cantidad as textoCantidad, leerNumero, pesos, precio as textoPrecio } from "../formato";
import { NUMERO_INVALIDO, type Insumo } from "../inventario";
import { hoyBogota, recordado, recordar, sinTildes, type Cuenta } from "../ventas";

// Registrar compra, copiada de docs/mockups/fuentes/compra-mac.html.
const CAMPO =
  "h-[52px] w-full min-w-0 rounded-2xl border-[1.5px] border-borde-campo bg-superficie px-[18px] text-base text-tinta outline-none focus:border-2 focus:border-rosa focus:shadow-[0_0_0_4px_var(--color-rosa-claro)]";
const COLUMNAS = "md:grid md:grid-cols-[minmax(0,2fr)_110px_170px_150px_120px_44px] md:items-center md:gap-2.5";
const MUESTRA: Record<string, string> = {
  hilo: "bg-rosa-palo",
  cuentas: "bg-lila-fondo",
  herraje: "bg-dorado",
  forro: "bg-ok-fondo",
  argolla: "bg-dorado",
  empaque: "bg-alerta-fondo",
  otro: "bg-borde-muestra",
};

type Fila = { insumo: Insumo; cantidad: string; enCompra: boolean; precio: string };

function nueva(insumo: Insumo): Fila {
  const enCompra = Boolean(insumo.unidad_compra && insumo.factor_compra);
  const base = insumo.precio_unitario;
  const valor = base === null ? null : enCompra ? base * insumo.factor_compra! : base;
  return { insumo, cantidad: "", enCompra, precio: valor === null ? "" : textoPrecio(valor) };
}

/** Igual que el servidor: cantidad en la unidad propia × precio por esa unidad redondeado a centavos. */
function subtotal(f: Fila): number | null {
  const c = leerNumero(f.cantidad);
  const p = leerNumero(f.precio);
  if (c === null || p === null) return null;
  const factor = f.enCompra ? (f.insumo.factor_compra ?? 1) : 1;
  return Math.round(c * factor * (Math.round((p / factor) * 100) / 100));
}

function FilaInsumo({ fila, alCambiar, alQuitar }: { fila: Fila; alCambiar: (f: Fila) => void; alQuitar: () => void }) {
  const { insumo } = fila;
  const factor = insumo.factor_compra ?? 1;

  function cambiarUnidad(enCompra: boolean) {
    if (enCompra === fila.enCompra) return;
    const c = leerNumero(fila.cantidad);
    const p = leerNumero(fila.precio);
    alCambiar({
      ...fila,
      enCompra,
      cantidad: c === null ? fila.cantidad : textoCantidad(enCompra ? c / factor : c * factor),
      precio: p === null ? fila.precio : textoPrecio(enCompra ? p * factor : p / factor),
    });
  }

  const valor = subtotal(fila);
  const unidades = insumo.unidad_compra
    ? ([
        [true, insumo.unidad_compra],
        [false, insumo.unidad],
      ] as const)
    : ([[false, insumo.unidad]] as const);
  return (
    <div role="group" aria-label={insumo.nombre} className={`flex flex-col gap-2.5 border-t border-borde py-3 ${COLUMNAS}`}>
      {/* En la Mac la fila es una rejilla de 6 columnas: «Quitar» pasa a la última con order. */}
      <div className="flex items-center gap-2.5 md:contents">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-borde-muestra)] ${MUESTRA[insumo.tipo] ?? MUESTRA.otro}`} />
          <span className="min-w-0 truncate text-[15px] font-extrabold">{insumo.nombre}</span>
        </span>
        <button
          type="button"
          aria-label={`Quitar ${insumo.nombre}`}
          title="Quitar"
          onClick={alQuitar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-suave focus-visible:outline-2 focus-visible:outline-rosa md:order-1"
        >
          <IconoCerrar tamano={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:contents">
        <input aria-label={`Cantidad de ${insumo.nombre}`} inputMode="decimal" placeholder="0" value={fila.cantidad} onChange={(e) => alCambiar({ ...fila, cantidad: e.target.value })} className={`${CAMPO} text-right`} />
        <span className="flex rounded-full bg-rosa-claro p-1">
          {unidades.map(([enCompra, texto]) => (
            <button
              key={texto}
              type="button"
              aria-pressed={fila.enCompra === enCompra}
              onClick={() => cambiarUnidad(enCompra)}
              className={`min-h-9 flex-1 rounded-full px-1.5 text-[13px] ${fila.enCompra === enCompra ? "bg-superficie font-extrabold text-rosa-activo shadow-pestana" : "font-bold text-suave"}`}
            >
              {texto}
            </button>
          ))}
        </span>
        <input aria-label={`Precio de ${insumo.nombre}`} inputMode="decimal" placeholder="$ 0" value={fila.precio} onChange={(e) => alCambiar({ ...fila, precio: e.target.value })} className={`${CAMPO} text-right`} />
        <span className="flex items-center justify-end text-[15px] font-extrabold">{valor === null ? "—" : pesos(valor)}</span>
      </div>
    </div>
  );
}

export default function NuevaCompra() {
  const navegar = useNavigate();
  const hoy = hoyBogota();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [pago, setPago] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([pedir<Insumo[]>("/api/inventario/insumos"), pedir<Cuenta[]>("/api/cuentas"), pedir<string[]>("/api/compras/proveedores")])
      .then(([i, c, p]) => {
        setInsumos(i);
        setCuentas(c);
        setProveedores(p);
        const guardada = recordado("compra.cuenta");
        setPago(guardada === "despues" || c.some((x) => String(x.id) === guardada) ? guardada! : String(c[0]?.id ?? "despues"));
      })
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  const usados = new Set(filas.map((f) => f.insumo.id));
  const texto = sinTildes(buscar.trim());
  const disponibles = insumos.filter((i) => !usados.has(i.id) && (!texto || sinTildes(i.nombre).includes(texto)));
  const total = filas.reduce((suma, f) => suma + (subtotal(f) ?? 0), 0);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (filas.length === 0) return setError("Agrega al menos un insumo.");
    const items = [];
    for (const f of filas) {
      const c = leerNumero(f.cantidad);
      const p = leerNumero(f.precio);
      if (c === null || c <= 0 || p === null || p < 0) return setError(`${NUMERO_INVALIDO} Revisa ${f.insumo.nombre}.`);
      items.push({ insumo_id: f.insumo.id, cantidad: c, en_unidad_compra: f.enCompra, precio_unitario: p });
    }
    setEnviando(true);
    try {
      const compra = await enviar<Compra>("/api/compras", {
        proveedor: proveedor.trim() || null,
        fecha: fecha === hoy ? null : fecha,
        cuenta_id: pago === "despues" ? null : Number(pago),
        nota: null,
        items,
      });
      recordar("compra.cuenta", pago);
      navegar(`/compras/${compra.id}`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-6">
      <Encabezado
        titulo="Registrar compra"
        subtitulo="Lo que compraste entra al inventario y, si ya lo pagaste, sale de tu cuenta."
        acciones={
          <BotonPastilla onClick={() => navegar(-1)} type="button">
            Cancelar
          </BotonPastilla>
        }
      />
      <section className="flex min-w-0 flex-col gap-5 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-2 text-sm font-extrabold">
            Proveedor
            <input list="proveedores" value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={120} autoComplete="off" className={`${CAMPO} font-normal`} />
            <datalist id="proveedores">
              {proveedores.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-2 text-sm font-extrabold">
            Fecha
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={`${CAMPO} font-normal`} />
          </label>
        </div>

        <div className="flex flex-col">
          <div className={`hidden pb-2 text-[13px] font-extrabold text-suave ${COLUMNAS}`}>
            <span>Insumo</span>
            <span className="text-right">Cantidad</span>
            <span>Contado en</span>
            <span className="text-right">Precio c/u</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>
          {filas.length === 0 && <p className="border-t border-borde py-3 text-sm text-suave">Agrega los insumos que compraste.</p>}
          {filas.map((f, i) => (
            <FilaInsumo key={f.insumo.id} fila={f} alCambiar={(nuevaFila) => (setFilas(filas.map((x, j) => (j === i ? nuevaFila : x))), setError(""))} alQuitar={() => setFilas(filas.filter((_, j) => j !== i))} />
          ))}
          <div className="flex flex-col gap-3 border-t border-borde pt-3">
            {eligiendo ? (
              <div className="flex flex-col gap-2 rounded-[22px] bg-fondo p-3">
                <label className="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-borde-campo bg-superficie px-4 text-suave focus-within:border-rosa">
                  <IconoBuscar tamano={18} />
                  <span className="sr-only">Buscar insumo</span>
                  <input type="search" autoFocus value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar insumo" className="w-full border-0 bg-transparent text-[15px] text-tinta outline-none" />
                </label>
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {disponibles.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => (setFilas([...filas, nueva(i)]), setEligiendo(false), setBuscar(""), setError(""))}
                      className="flex min-h-11 items-center gap-2.5 rounded-2xl px-3 text-left hover:bg-superficie focus-visible:outline-2 focus-visible:outline-rosa"
                    >
                      <span aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${MUESTRA[i.tipo] ?? MUESTRA.otro}`} />
                      <span className="flex-1 text-[15px] font-bold">{i.nombre}</span>
                      <span className="text-xs text-suave">{i.unidad_compra ? `${i.unidad_compra} o ${i.unidad}` : i.unidad}</span>
                    </button>
                  ))}
                  {disponibles.length === 0 && <p className="px-3 py-2 text-sm text-suave">No hay más insumos con ese nombre.</p>}
                </div>
                <button type="button" onClick={() => setEligiendo(false)} className="min-h-11 self-start px-3 text-sm font-extrabold text-rosa-oscuro">
                  Cerrar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEligiendo(true)}
                className="flex h-11 items-center gap-2 self-start rounded-full border-[1.5px] border-dashed border-rosa-palo bg-superficie px-4 text-sm font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa"
              >
                <IconoSumar tamano={16} />
                Agregar insumo
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-5 border-t border-borde pt-4">
          <div className="flex flex-col gap-2.5">
            <span className="text-base font-extrabold">¿La pagaste?</span>
            <Pastillas etiqueta="¿La pagaste?" opciones={[...cuentas.map((c) => [String(c.id), c.nombre] as const), ["despues", "Después"] as const]} valor={pago} alElegir={setPago} />
            <span className="text-[13px] text-suave">Si eliges «Después», queda en «Compras sin pagar» de Mis cuentas.</span>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-5 md:w-auto">
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-[13px] font-bold text-suave">{filas.length === 1 ? "1 insumo" : `${filas.length} insumos`}</span>
              <span className="text-[34px] leading-tight font-extrabold tracking-[-0.01em]">{pesos(total)}</span>
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-rosa px-[22px] text-[15px] font-extrabold text-white shadow-boton hover:bg-rosa-activo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60"
            >
              <IconoListo tamano={18} trazo={2.4} />
              Guardar compra
            </button>
          </div>
        </div>
        <MensajeError texto={error} />
      </section>
    </form>
  );
}
