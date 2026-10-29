import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import { Boton, Campo, MensajeError } from "../componentes/Formulario";
import { leerNumero, pesos } from "../formato";
import { miniatura, NUMERO_INVALIDO } from "../inventario";
import { CANALES, hoyBogota, recordado, recordar, sinTildes, type CatalogoItem, type Cuenta, type Venta } from "../ventas";

const opcion = (activa: boolean) =>
  `h-11 rounded-full border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-rosa ${
    activa ? "border-rosa bg-rosa text-white" : "border-borde bg-superficie"
  }`;

function Eleccion({ etiqueta, opciones, valor, alElegir }: { etiqueta: string; opciones: readonly (readonly [string, string])[]; valor: string; alElegir: (v: string) => void }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-sm font-semibold">{etiqueta}</p>
      <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {opciones.map(([v, texto]) => (
          <button key={v} type="button" aria-pressed={valor === v} onClick={() => alElegir(v)} className={opcion(valor === v)}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Vender() {
  const navegar = useNavigate();
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [carrito, setCarrito] = useState<Record<number, number>>({});
  const [buscar, setBuscar] = useState("");
  const [canal, setCanal] = useState(() => {
    const guardado = recordado("venta.canal");
    return CANALES.some(([v]) => v === guardado) ? guardado! : "presencial";
  });
  const [cuenta, setCuenta] = useState("");
  const [descuento, setDescuento] = useState("");
  const hoy = hoyBogota();
  // null = hoy. Solo cambia si ella elige otro día: así una pantalla abierta desde ayer no fecha la venta en ayer.
  const [fecha, setFecha] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([pedir<CatalogoItem[]>("/api/ventas/catalogo"), pedir<Cuenta[]>("/api/cuentas")])
      .then(([items, lista]) => {
        setCatalogo(items);
        setCuentas(lista);
        const guardada = recordado("venta.cuenta");
        setCuenta(lista.some((c) => String(c.id) === guardada) ? guardada! : String(lista[0]?.id ?? ""));
      })
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  const porId = new Map((catalogo ?? []).map((i) => [i.variante_id, i]));
  const lineas = Object.entries(carrito)
    .map(([id, n]) => ({ item: porId.get(Number(id))!, n }))
    .filter((l) => l.item);
  const subtotal = lineas.reduce((suma, l) => suma + l.item.precio * l.n, 0);
  const valorDescuento = descuento.trim() ? leerNumero(descuento) : 0;
  const total = subtotal - (valorDescuento !== null && valorDescuento > 0 ? Math.round(valorDescuento) : 0);

  function cambiar(item: CatalogoItem, delta: number) {
    setError("");
    const actual = carrito[item.variante_id] ?? 0;
    if (actual + delta > item.existencia) return setAviso(`Solo hay ${item.existencia} en vitrina.`);
    setAviso("");
    const siguiente = { ...carrito };
    if (actual + delta <= 0) delete siguiente[item.variante_id];
    else siguiente[item.variante_id] = actual + delta;
    setCarrito(siguiente);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (lineas.length === 0) return setError("Toca un producto para agregarlo a la venta.");
    if (valorDescuento === null || valorDescuento < 0) return setError(NUMERO_INVALIDO);
    if (Math.round(valorDescuento) > subtotal) return setError("El descuento no puede ser mayor que el subtotal.");
    setEnviando(true);
    try {
      const venta = await enviar<Venta>("/api/ventas", {
        canal,
        cuenta_id: Number(cuenta),
        descuento: Math.round(valorDescuento),
        fecha: fecha && fecha !== hoyBogota() ? fecha : null,
        nota: null,
        items: lineas.map((l) => ({ variante_id: l.item.variante_id, cantidad: l.n })),
      });
      recordar("venta.canal", canal);
      recordar("venta.cuenta", cuenta);
      navegar(`/ventas/${venta.id}`, { state: { guardada: true } });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  if (catalogo === null) return error ? <p role="alert" className="font-semibold text-error">{error}</p> : null;
  if (catalogo.length === 0) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-bold">Vender</h1>
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <p className="mb-4 text-suave">No hay productos en vitrina.</p>
          <Link to="/productos" className="inline-flex h-11 items-center font-semibold text-rosa-oscuro underline">
            Ir a productos
          </Link>
        </div>
      </>
    );
  }

  const palabras = sinTildes(buscar).split(/\s+/).filter(Boolean);
  const visibles = catalogo.filter((i) => {
    const pajar = sinTildes(`${i.nombre} ${i.color} ${i.sku}`);
    return palabras.every((p) => pajar.includes(p));
  });

  return (
    <form onSubmit={guardar} noValidate>
      <h1 className="mb-4 text-2xl font-bold">Vender</h1>
      <Campo etiqueta="Buscar" type="search" required={false} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibles.map((i) => {
          const enVenta = carrito[i.variante_id] ?? 0;
          return (
            <li key={i.variante_id}>
              <button
                type="button"
                onClick={() => cambiar(i, 1)}
                className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-superficie text-left focus-visible:outline-2 focus-visible:outline-rosa ${
                  enVenta ? "border-rosa ring-2 ring-rosa" : "border-borde hover:border-rosa"
                }`}
              >
                {i.foto ? (
                  <img src={miniatura(i.foto)} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span aria-hidden className="aspect-square w-full bg-rosa-palo/40" />
                )}
                <span className="p-2">
                  <span className="block truncate font-bold">{i.nombre}</span>{" "}
                  <span className="block truncate text-sm">{i.color}</span>{" "}
                  <span className="block font-semibold">{pesos(i.precio)}</span>{" "}
                  <span className="block text-sm text-suave">{`${i.existencia} en vitrina`}</span>
                  {enVenta > 0 && <span className="block text-sm font-bold text-rosa-oscuro">{` ${enVenta} en la venta`}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {aviso && (
        <p role="alert" className="mb-4 font-semibold text-error">
          {aviso}
        </p>
      )}
      <section aria-label="Venta" className="mb-4 rounded-2xl border border-borde bg-superficie p-4">
        <h2 className="mb-3 text-lg font-bold">Venta</h2>
        {lineas.length === 0 ? (
          <p className="mb-4 text-suave">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="mb-4 divide-y divide-borde">
            {lineas.map(({ item, n }) => {
              const nombre = `${item.nombre} ${item.color}`;
              return (
                <li key={item.variante_id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{`${item.nombre} · ${item.color}`}</span>
                    <span className="text-sm text-suave">{pesos(item.precio * n)}</span>
                  </span>
                  <button type="button" aria-label={`Quitar uno de ${nombre}`} onClick={() => cambiar(item, -1)} className="h-11 w-11 rounded-lg border border-borde text-xl font-bold">
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{n}</span>
                  <button type="button" aria-label={`Agregar uno de ${nombre}`} onClick={() => cambiar(item, 1)} className="h-11 w-11 rounded-lg border border-borde text-xl font-bold">
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Eleccion etiqueta="Canal" opciones={CANALES} valor={canal} alElegir={setCanal} />
        <Eleccion etiqueta="Pagó en" opciones={cuentas.map((c) => [String(c.id), c.nombre] as const)} valor={cuenta} alElegir={setCuenta} />
        <Campo etiqueta="Descuento (opcional)" inputMode="numeric" required={false} value={descuento} onChange={(e) => { setDescuento(e.target.value); setError(""); }} />
        <Campo etiqueta="Fecha" type="date" max={hoy} value={fecha ?? hoy} onChange={(e) => setFecha(e.target.value || null)} />
        <MensajeError texto={error} />
      </section>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
        <Boton type="submit" disabled={enviando}>{`Guardar venta ${pesos(Math.max(total, 0))}`}</Boton>
      </div>
    </form>
  );
}
