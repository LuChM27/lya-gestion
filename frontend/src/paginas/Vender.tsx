import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import { Campo, MensajeError } from "../componentes/Formulario";
import { IconoListo, IconoPersona, IconoVolver } from "../componentes/iconos";
import { BotonPrincipal, Buscador, FotoProducto, Pastillas, Vacio } from "../componentes/ui";
import { leerNumero, pesos } from "../formato";
import { NUMERO_INVALIDO } from "../inventario";
import { CANALES, hoyBogota, recordado, recordar, sinTildes, type CatalogoItem, type Cuenta, type Venta } from "../ventas";

// docs/mockups/fuentes/venta-celular.html: tres pasos numerados y la franja fija con total y «Guardar venta».
// Descuento y fecha no salen en el mockup: van guardados en «Más opciones».

function Paso({ numero, titulo, extra, children }: { numero: number; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold">
          <span className="text-rosa">{numero}.</span> {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

const ENLACE = "text-[13px] font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa";

export default function Vender() {
  const navegar = useNavigate();
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [carrito, setCarrito] = useState<Record<number, number>>({});
  const [buscando, setBuscando] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [canal, setCanal] = useState(() => {
    const guardado = recordado("venta.canal");
    return CANALES.some(([v]) => v === guardado) ? guardado! : "presencial";
  });
  const [cuenta, setCuenta] = useState("");
  const [opciones, setOpciones] = useState(false);
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
  const unidades = lineas.reduce((suma, l) => suma + l.n, 0);
  const subtotal = lineas.reduce((suma, l) => suma + l.item.precio * l.n, 0);
  const valorDescuento = descuento.trim() ? leerNumero(descuento) : 0;
  const total = subtotal - (valorDescuento !== null && valorDescuento > 0 ? Math.round(valorDescuento) : 0);
  const vacia = lineas.length === 0;

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
    if (vacia) return setError("Toca un producto para agregarlo a la venta.");
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
      // Otro dispositivo pudo vender lo último: se trae la vitrina de nuevo y la venta se ajusta a lo que hay.
      if (err instanceof ErrorApi && err.estado === 422) await recargarVitrina();
    }
  }

  async function recargarVitrina() {
    try {
      const items = await pedir<CatalogoItem[]>("/api/ventas/catalogo");
      const existencia = new Map(items.map((i) => [i.variante_id, i.existencia]));
      setCatalogo(items);
      setCarrito((actual) =>
        Object.fromEntries(
          Object.entries(actual)
            .map(([id, n]) => [id, Math.min(n, existencia.get(Number(id)) ?? 0)] as const)
            .filter(([, n]) => n > 0),
        ),
      );
    } catch {
      // si falla, queda la vitrina anterior y el mensaje del servidor
    }
  }

  const encabezado = (
    <header className="flex h-12 items-center gap-3">
      <button
        type="button"
        aria-label="Volver"
        onClick={() => navegar(-1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media focus-visible:outline-2 focus-visible:outline-rosa"
      >
        <IconoVolver />
      </button>
      <h1 className="font-titulo text-[26px] font-semibold">Venta rápida</h1>
      <span className="ml-auto rounded-full bg-rosa-claro px-2.5 py-[5px] text-xs font-extrabold text-rosa-oscuro">3 toques</span>
    </header>
  );

  if (catalogo === null) return error ? <p role="alert" className="font-bold text-error">{error}</p> : null;
  if (catalogo.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px]">
        {encabezado}
        <Vacio texto="No hay productos en vitrina.">
          <BotonPrincipal a="/productos">Ir a productos</BotonPrincipal>
        </Vacio>
      </div>
    );
  }

  const palabras = sinTildes(buscar).split(/\s+/).filter(Boolean);
  const visibles = catalogo.filter((i) => {
    const pajar = sinTildes(`${i.nombre} ${i.color} ${i.sku}`);
    return palabras.every((p) => pajar.includes(p));
  });

  return (
    <form onSubmit={guardar} noValidate className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px] pb-[calc(170px+env(safe-area-inset-bottom))] md:pb-0">
      {encabezado}

      <Paso
        numero={1}
        titulo="¿Qué vendiste?"
        extra={
          <button type="button" aria-expanded={buscando} onClick={() => setBuscando((b) => !b)} className={ENLACE}>
            Buscar
          </button>
        }
      >
        {buscando && <Buscador valor={buscar} alCambiar={setBuscar} placeholder="Modelo, color o código" />}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visibles.map((i) => {
            const enVenta = carrito[i.variante_id] ?? 0;
            return (
              <button
                key={i.variante_id}
                type="button"
                aria-pressed={enVenta > 0}
                onClick={() => cambiar(i, 1)}
                className={`relative flex flex-col gap-2 rounded-[20px] border-2 bg-superficie px-2 pt-2 pb-3 text-left text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${
                  enVenta ? "border-rosa shadow-elegida" : "border-borde"
                }`}
              >
                <FotoProducto foto={i.foto} categoria={i.categoria} nombre={i.nombre} className="h-[78px] rounded-[14px]" icono={34} />
                <span className="flex flex-col gap-px px-1">
                  <span className="line-clamp-2 text-[13px] leading-[1.25] font-extrabold">{i.nombre}</span>{" "}
                  <span className="text-[13px] font-bold text-tinta-media">{i.color}</span>{" "}
                  <span className="text-[13px] font-bold text-suave">{pesos(i.precio)}</span>{" "}
                  <span className="text-xs text-suave">{`${i.existencia} en vitrina`}</span>
                </span>
                {enVenta > 0 && (
                  <span aria-hidden className="absolute top-3.5 right-3.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-rosa text-xs font-extrabold text-white">
                    {enVenta === 1 ? <IconoListo tamano={14} /> : enVenta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {aviso && (
          <p role="alert" className="text-sm font-bold text-error">
            {aviso}
          </p>
        )}
        {lineas.length > 0 && (
          <ul aria-label="En esta venta" className="flex flex-col gap-2">
            {lineas.map(({ item, n }) => {
              const nombre = `${item.nombre} ${item.color}`;
              return (
                <li key={item.variante_id} className="flex items-center gap-2 rounded-[18px] border border-borde bg-superficie py-1.5 pr-1.5 pl-3.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{`${item.nombre} · ${item.color}`}</span>
                  <button type="button" aria-label={`Quitar uno de ${nombre}`} onClick={() => cambiar(item, -1)} className="h-11 w-11 rounded-full border-[1.5px] border-borde-campo text-xl font-extrabold text-tinta-media">
                    −
                  </button>
                  <span className="w-6 text-center font-extrabold">{n}</span>
                  <button type="button" aria-label={`Agregar uno de ${nombre}`} onClick={() => cambiar(item, 1)} className="h-11 w-11 rounded-full border-[1.5px] border-borde-campo text-xl font-extrabold text-tinta-media">
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Paso>

      <Paso numero={2} titulo="¿Por dónde te compró?">
        <Pastillas etiqueta="Canal" opciones={CANALES} valor={canal} alElegir={setCanal} />
      </Paso>

      <Paso numero={3} titulo="¿Cómo te pagó?">
        <Pastillas etiqueta="Pagó en" opciones={cuentas.map((c) => [String(c.id), c.nombre] as const)} valor={cuenta} alElegir={setCuenta} />
      </Paso>

      <div>
        <button type="button" aria-expanded={opciones} onClick={() => setOpciones((o) => !o)} className={`${ENLACE} h-11`}>
          Más opciones
        </button>
        {opciones && (
          <div className="mt-2 grid gap-x-4 sm:grid-cols-2">
            <Campo etiqueta="Descuento (opcional)" inputMode="numeric" required={false} value={descuento} onChange={(e) => { setDescuento(e.target.value); setError(""); }} />
            <Campo etiqueta="Fecha" type="date" max={hoy} value={fecha ?? hoy} onChange={(e) => setFecha(e.target.value || null)} />
          </div>
        )}
      </div>

      <section
        aria-label="Total"
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-[28px] bg-superficie px-5 pt-4 pb-[max(22px,env(safe-area-inset-bottom))] shadow-franja md:sticky md:bottom-4 md:rounded-[28px] md:pb-5"
      >
        <MensajeError texto={error} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-suave">{vacia ? "Nada elegido aún" : unidades === 1 ? "1 producto" : `${unidades} productos`}</span>
            <span className="text-[26px] font-extrabold tracking-[-0.01em]">{pesos(Math.max(total, 0))}</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-rosa-claro px-3 py-2 text-[13px] font-extrabold text-rosa-oscuro">
            <IconoPersona tamano={16} />
            Cliente de mostrador
          </span>
        </div>
        <button
          type="submit"
          disabled={vacia || enviando}
          className={`h-14 rounded-full text-[17px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${
            vacia ? "bg-borde text-apagado" : "bg-rosa text-white shadow-boton-grande"
          }`}
        >
          {vacia ? "Elige un producto" : "Guardar venta"}
        </button>
      </section>
    </form>
  );
}
