import { useEffect, useState, type FormEvent } from "react";
import { actualizar, enviar, ErrorApi, pedir } from "../api";
import { leerPesos, MONTO_INVALIDO, TITULOS, type Categoria, type Movimiento, type TipoMovimiento } from "../dinero";
import { pesos } from "../formato";
import { hoyBogota, recordado, recordar, type Cuenta } from "../ventas";
import { Boton, BotonSecundario, Campo, MensajeError } from "./Formulario";
import { Pastillas } from "./ui";

// Formularios de Mis cuentas con las piezas de docs/mockups/fuentes/cuentas-mac.html y login-mac.html.
const GUARDAR: Record<TipoMovimiento, string> = {
  gasto: "Guardar gasto",
  ingreso: "Guardar ingreso",
  retiro: "Guardar retiro",
  transferencia: "Guardar transferencia",
};

export type Prellenado = { monto?: number; categoria_id?: number; cuenta_id?: number | null; gasto_fijo_id?: number; nota?: string };

/** «2026-11-25T15:00:00Z» → «2026-11-25» en Bogotá, el formato de <input type="date">. */
const diaBogota = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));

export default function FormularioMovimiento({
  tipo,
  inicial,
  prellenado,
  alGuardar,
  alCancelar,
}: {
  tipo: TipoMovimiento;
  inicial?: Movimiento;
  prellenado?: Prellenado;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const hoy = hoyBogota();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [monto, setMonto] = useState(() => {
    const n = inicial?.monto ?? prellenado?.monto;
    return n ? pesos(n) : "";
  });
  const texto = (n: number | null | undefined) => (n ? String(n) : "");
  const [categoria, setCategoria] = useState(texto(inicial ? inicial.categoria_id : prellenado?.categoria_id));
  const [cuenta, setCuenta] = useState(texto(inicial ? inicial.cuenta_id : prellenado?.cuenta_id));
  const [destino, setDestino] = useState(texto(inicial?.cuenta_destino_id));
  const fechaInicial = inicial ? diaBogota(inicial.fecha) : hoy;
  const [fecha, setFecha] = useState(fechaInicial);
  const [nota, setNota] = useState(inicial ? (inicial.nota ?? "") : (prellenado?.nota ?? ""));
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const conCategoria = tipo === "gasto" || tipo === "ingreso";

  useEffect(() => {
    const pedidos: [Promise<Cuenta[]>, Promise<Categoria[]>] = [
      pedir<Cuenta[]>("/api/cuentas"),
      conCategoria ? pedir<Categoria[]>(`/api/categorias?tipo=${tipo}`) : Promise.resolve([]),
    ];
    Promise.all(pedidos)
      .then(([lista, cats]) => {
        const usables = cats.filter((c) => c.nombre !== "Ventas");
        setCuentas(lista);
        setCategorias(usables);
        if (inicial) return;
        setCuenta((actual) => {
          if (actual) return actual;
          const guardada = recordado("gasto.cuenta");
          return lista.some((c) => String(c.id) === guardada) ? guardada! : String(lista[0]?.id ?? "");
        });
        if (tipo === "transferencia") setDestino(String(lista[1]?.id ?? ""));
      })
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [tipo, conCategoria, inicial]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const valor = leerPesos(monto);
    if (valor === null || valor <= 0) return setError(MONTO_INVALIDO);
    if (conCategoria && !categoria) return setError("Elige una categoría.");
    if (!cuenta) return setError("Elige una cuenta.");
    if (tipo === "transferencia" && cuenta === destino) return setError("Elige dos cuentas distintas.");
    const cuerpo = {
      tipo,
      monto: valor,
      cuenta_id: Number(cuenta),
      cuenta_destino_id: tipo === "transferencia" ? Number(destino) : null,
      categoria_id: conCategoria ? Number(categoria) : null,
      // Sin cambio de día, el servidor deja la hora: hoy es ahora; al editar, la que tenía.
      fecha: fecha === fechaInicial && (inicial || fecha === hoy) ? null : fecha,
      nota: nota.trim() || null,
      gasto_fijo_id: prellenado?.gasto_fijo_id ?? inicial?.gasto_fijo_id ?? null,
    };
    setEnviando(true);
    try {
      if (inicial) await actualizar(`/api/movimientos/${inicial.id}`, cuerpo);
      else await enviar("/api/movimientos", cuerpo);
      recordar("gasto.cuenta", cuenta);
      alGuardar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  // Al editar, la cuenta o categoría que ya tenía sale aunque se haya archivado después.
  const opcionesCuenta = cuentas.map((c) => [String(c.id), c.nombre] as const);
  for (const [id, nombre] of [[inicial?.cuenta_id, inicial?.cuenta], [inicial?.cuenta_destino_id, inicial?.cuenta_destino]] as const) {
    if (id && nombre && !opcionesCuenta.some(([v]) => v === String(id))) opcionesCuenta.push([String(id), nombre]);
  }
  const opcionesCategoria = categorias.map((c) => [String(c.id), c.nombre] as const);
  if (inicial?.categoria_id && inicial.categoria && !opcionesCategoria.some(([v]) => v === String(inicial.categoria_id))) {
    opcionesCategoria.push([String(inicial.categoria_id), inicial.categoria]);
  }
  const titulo = inicial ? "Editar movimiento" : TITULOS[tipo];

  return (
    <section aria-label={titulo} className="flex flex-col gap-4 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6">
      <h2 className="font-titulo text-[26px] font-semibold">{titulo}</h2>
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <div className="grid gap-x-4 md:grid-cols-2">
          <Campo etiqueta="Monto" value={monto} onChange={(e) => (setMonto(e.target.value), setError(""))} inputMode="numeric" autoComplete="off" placeholder="$ 0" />
          <Campo etiqueta="Fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} />
        </div>
        {conCategoria && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold">Categoría</span>
            <Pastillas etiqueta="Categoría" opciones={opcionesCategoria} valor={categoria} alElegir={(v) => (setCategoria(v), setError(""))} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold">{tipo === "transferencia" ? "De" : tipo === "ingreso" ? "¿A qué cuenta entró?" : "¿De dónde salió?"}</span>
          <Pastillas etiqueta={tipo === "transferencia" ? "De" : "Cuenta"} opciones={opcionesCuenta} valor={cuenta} alElegir={(v) => (setCuenta(v), setError(""))} />
        </div>
        {tipo === "transferencia" && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold">A</span>
            <Pastillas etiqueta="A" opciones={opcionesCuenta} valor={destino} alElegir={(v) => (setDestino(v), setError(""))} />
          </div>
        )}
        <Campo etiqueta="Nota (opcional)" required={false} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
        <MensajeError texto={error} />
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-start">
          <Boton type="submit" disabled={enviando} className="sm:w-auto">
            {inicial ? "Guardar cambios" : GUARDAR[tipo]}
          </Boton>
          <BotonSecundario onClick={alCancelar} className="h-14">
            Cancelar
          </BotonSecundario>
        </div>
      </form>
    </section>
  );
}
