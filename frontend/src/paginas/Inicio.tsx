import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorApi, pedir } from "../api";
import { IconoSiguiente, IconoSumar } from "../componentes/iconos";
import { BotonPrincipal, Encabezado, type EstadoStock } from "../componentes/ui";
import { pesos } from "../formato";
import { nombreCanal } from "../ventas";

// docs/mockups/fuentes/inicio-mac.html e inicio-celular.html. Ganancia, por cobrar y la gráfica
// llegan con sus módulos; mientras tanto se muestran las cifras que ya existen.
type Aviso = { tipo: "producto" | "insumo"; id: number; nombre: string; detalle: string; estado: EstadoStock };
type DatosInicio = {
  ventas_hoy: { total: number; cantidad: number; por_canal: Record<string, number> };
  ventas_mes: { total: number; cantidad: number; mes: string };
  vitrina: { piezas: number; valor: number };
  avisos: Aviso[];
  por_revisar: { productos: number; insumos: number };
};

const ventas = (n: number) => `${n} ${n === 1 ? "venta" : "ventas"}`;

function porCanal(canales: Record<string, number>): string {
  return Object.entries(canales)
    .sort((a, b) => b[1] - a[1])
    .map(([canal, n]) => (canal === "presencial" ? `${n} en persona` : canal === "feria" ? `${n} en feria` : `${n} por ${nombreCanal(canal)}`))
    .join(", ");
}

// Fondo de la fila (Mac) o del cuadrito (celular) y color del punto, como en los mockups.
const TONO: Record<EstadoStock, [string, string]> = {
  bajo_minimo: ["bg-peligro-fondo", "bg-peligro"],
  por_agotarse: ["bg-alerta-fondo", "bg-dorado"],
  ok: ["bg-ok-fondo", "bg-ok"],
};

const TARJETA = "flex flex-col gap-1 rounded-[22px] border border-borde bg-superficie p-4 md:gap-2.5 md:rounded-3xl md:p-[22px] md:shadow-tarjeta";
const TITULO_TARJETA = "text-[13px] font-bold text-suave md:text-sm";
const CIFRA = "text-xl font-extrabold tracking-[-0.01em] md:text-[30px] md:leading-tight";

export default function Inicio() {
  const [datos, setDatos] = useState<DatosInicio | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<DatosInicio>("/api/inicio")
      .then(setDatos)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  const avisos = datos?.avisos ?? [];
  // Los avisos llegan cortados en 5; los conteos vienen completos en por_revisar.
  const porAgotarse = datos?.por_revisar.productos ?? 0;
  const pendientes = porAgotarse + (datos?.por_revisar.insumos ?? 0);
  return (
    <>
      <Encabezado
        fecha
        titulo="¡Hola de nuevo!"
        subtitulo={
          datos && (
            <span className="hidden md:inline">
              {pendientes ? `Tienes ${pendientes} ${pendientes === 1 ? "aviso" : "avisos"} para revisar.` : "Todo está en orden por hoy."}
            </span>
          )
        }
        acciones={
          <div className="hidden md:block">
            <BotonPrincipal a="/vender" icono={IconoSumar}>
              Nueva venta
            </BotonPrincipal>
          </div>
        }
      />
      {error && <p role="alert" className="font-bold text-error">{error}</p>}
      {datos && (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-4">
            <div className="relative col-span-2 flex flex-col gap-1.5 overflow-hidden rounded-[28px] bg-rosa p-[22px] text-white shadow-destacada md:col-span-1 md:rounded-3xl">
              <span aria-hidden className="absolute -top-[50px] -right-10 h-[140px] w-[140px] rounded-full bg-rosa-burbuja" />
              <span className="relative text-sm font-bold">Vendiste hoy</span>
              <span className="relative text-[34px] leading-tight font-extrabold tracking-[-0.01em] md:text-[30px]">{pesos(datos.ventas_hoy.total)}</span>
              <span className="relative text-sm font-bold">
                {datos.ventas_hoy.cantidad ? `${ventas(datos.ventas_hoy.cantidad)} · ${porCanal(datos.ventas_hoy.por_canal)}` : "Aún no hay ventas hoy"}
              </span>
            </div>
            <div className={TARJETA}>
              <span className={TITULO_TARJETA}>{`Ventas de ${datos.ventas_mes.mes}`}</span>
              <span className={CIFRA}>{pesos(datos.ventas_mes.total)}</span>
              <span className="self-start text-xs font-extrabold text-ok md:rounded-full md:bg-ok-fondo md:px-2.5 md:py-1 md:text-[13px]">{ventas(datos.ventas_mes.cantidad)}</span>
            </div>
            <div className={`${TARJETA} md:border-0 md:bg-rosa-claro md:shadow-none`}>
              <span className={TITULO_TARJETA}>En vitrina</span>
              <span className={CIFRA}>{`${datos.vitrina.piezas} ${datos.vitrina.piezas === 1 ? "pieza" : "piezas"}`}</span>
              <span className={`text-xs font-extrabold md:text-[13px] md:font-bold md:text-suave ${porAgotarse ? "text-alerta" : "text-ok"}`}>
                <span className="md:hidden">{porAgotarse ? `${porAgotarse} por revisar` : "Todo en orden"}</span>
                <span className="hidden md:inline">{`${pesos(datos.vitrina.valor)} a precio de venta`}</span>
              </span>
            </div>
          </section>

          <section className="flex max-w-[560px] flex-col gap-2.5 md:gap-4 md:rounded-[28px] md:border md:border-borde md:bg-superficie md:p-[26px] md:shadow-tarjeta">
            <h2 className="text-[17px] font-extrabold md:text-[19px]">Para no olvidar</h2>
            {avisos.length === 0 ? (
              <p className="rounded-[18px] border border-borde bg-superficie px-3.5 py-3 text-sm md:border-0 md:bg-ok-fondo">Todo el inventario está en orden.</p>
            ) : (
              avisos.map((a) => {
                const [fondo, punto] = TONO[a.estado];
                return (
                  <Link
                    key={`${a.tipo}-${a.id}-${a.nombre}`}
                    to={a.tipo === "insumo" ? `/insumos/${a.id}` : `/productos/${a.id}`}
                    className={`flex items-center gap-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3 text-tinta no-underline hover:border-rosa md:items-start md:border-0 md:p-3 ${
                      a.estado === "bajo_minimo" ? "md:bg-peligro-fondo" : a.estado === "por_agotarse" ? "md:bg-alerta-fondo" : "md:bg-ok-fondo"
                    }`}
                  >
                    <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:mt-1.5 md:h-2.5 md:w-2.5 md:bg-transparent ${fondo}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${punto}`} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px md:gap-0.5">
                      <span className="truncate text-sm leading-[1.35] font-extrabold md:whitespace-normal">{a.nombre}</span>
                      <span className="truncate text-xs leading-[1.35] text-suave md:text-[13px] md:whitespace-normal md:text-tinta-detalle">{a.detalle}</span>
                    </span>
                    <IconoSiguiente tamano={16} className="shrink-0 text-flecha md:hidden" />
                  </Link>
                );
              })
            )}
          </section>
        </>
      )}
    </>
  );
}
