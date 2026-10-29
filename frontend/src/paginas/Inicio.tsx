import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorApi, pedir } from "../api";
import { BotonPrincipal, Encabezado, TarjetaCifra, Titulo, type EstadoStock } from "../componentes/ui";
import { pesos } from "../formato";
import { nombreCanal } from "../ventas";

// Diseño de «Inicio · Mac» e «Inicio · Celular». Ganancia, por cobrar y la gráfica llegan con sus módulos.
type Aviso = { tipo: "producto" | "insumo"; id: number; nombre: string; detalle: string; estado: EstadoStock };
type DatosInicio = {
  ventas_hoy: { total: number; cantidad: number; por_canal: Record<string, number> };
  ventas_mes: { total: number; cantidad: number; mes: string };
  vitrina: { piezas: number; valor: number };
  avisos: Aviso[];
};

const ventas = (n: number) => `${n} ${n === 1 ? "venta" : "ventas"}`;

function porCanal(canales: Record<string, number>): string {
  return Object.entries(canales)
    .sort((a, b) => b[1] - a[1])
    .map(([canal, n]) => (canal === "presencial" ? `${n} en persona` : canal === "feria" ? `${n} en feria` : `${n} por ${nombreCanal(canal)}`))
    .join(", ");
}

const PUNTO: Record<EstadoStock, string> = { bajo_minimo: "bg-peligro", por_agotarse: "bg-dorado", ok: "bg-ok" };
const FONDO_PUNTO: Record<EstadoStock, string> = { bajo_minimo: "bg-peligro-fondo", por_agotarse: "bg-alerta-fondo", ok: "bg-ok-fondo" };

export default function Inicio() {
  const [datos, setDatos] = useState<DatosInicio | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<DatosInicio>("/api/inicio")
      .then(setDatos)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  const hoy = datos?.ventas_hoy;
  return (
    <>
      <Encabezado
        fecha
        titulo="¡Hola de nuevo!"
        subtitulo={datos && (datos.avisos.length ? `Tienes ${datos.avisos.length} ${datos.avisos.length === 1 ? "aviso" : "avisos"} para revisar.` : "Todo está en orden por hoy.")}
        acciones={
          <BotonPrincipal a="/vender" icono={Plus} className="hidden md:inline-flex">
            Nueva venta
          </BotonPrincipal>
        }
      />
      {error && <p role="alert" className="mb-4 font-semibold text-error">{error}</p>}
      {datos && hoy && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <TarjetaCifra
                tono="rosa"
                titulo="Vendiste hoy"
                cifra={pesos(hoy.total)}
                detalle={hoy.cantidad ? `${ventas(hoy.cantidad)} · ${porCanal(hoy.por_canal)}` : "Aún no hay ventas hoy"}
              />
            </div>
            <TarjetaCifra titulo={`Ventas de ${datos.ventas_mes.mes}`} cifra={pesos(datos.ventas_mes.total)} detalle={<span className="text-suave">{ventas(datos.ventas_mes.cantidad)}</span>} />
            <TarjetaCifra
              tono="suave"
              titulo="En vitrina"
              cifra={`${datos.vitrina.piezas} ${datos.vitrina.piezas === 1 ? "pieza" : "piezas"}`}
              detalle={<span className="text-tinta-media">{`${pesos(datos.vitrina.valor)} a precio de venta`}</span>}
            />
          </div>
          <section className="max-w-2xl">
            <div className="mb-3">
              <Titulo nivel={2}>Para no olvidar</Titulo>
            </div>
            {datos.avisos.length === 0 ? (
              <p className="rounded-3xl border border-borde bg-superficie p-5 shadow-tarjeta">Todo el inventario está en orden.</p>
            ) : (
              <ul className="grid gap-3">
                {datos.avisos.map((a) => (
                  <li key={`${a.tipo}-${a.id}-${a.nombre}`}>
                    <Link
                      to={a.tipo === "insumo" ? `/insumos/${a.id}` : `/productos/${a.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-tarjeta hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
                    >
                      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${FONDO_PUNTO[a.estado]}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${PUNTO[a.estado]}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">{a.nombre}</span>
                        <span className="block text-sm text-suave">{a.detalle}</span>
                      </span>
                      <ChevronRight aria-hidden size={20} className="shrink-0 text-suave" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
