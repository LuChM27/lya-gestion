// Piezas compartidas, con los estilos exactos de docs/mockups/fuentes/*.html.
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { fechaLarga } from "../formato";
import { miniatura } from "../inventario";
import { IconoBolso } from "./iconos";

export type EstadoStock = "ok" | "por_agotarse" | "bajo_minimo";
type Icono = ComponentType<{ tamano?: number; trazo?: number }>;

/** Título en Fraunces: 30 px en el celular y 40 px en la Mac (inicio-mac, inicio-celular). */
export function Titulo({ children, nivel = 1 }: { children: ReactNode; nivel?: 1 | 2 }) {
  if (nivel === 2) return <h2 className="text-[17px] font-extrabold md:text-[19px]">{children}</h2>;
  return <h1 className="font-titulo text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] md:text-[40px] md:leading-[1.1]">{children}</h1>;
}

/** Fecha pequeña, título, subtítulo y acciones a la derecha (encabezado de inicio-mac e inventario-mac). */
export function Encabezado({ fecha = false, titulo, subtitulo, acciones }: { fecha?: boolean; titulo: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-0.5 md:gap-1.5">
        {fecha && <span className="text-sm font-bold text-suave">{fechaLarga(new Date().toISOString())}</span>}
        <Titulo>{titulo}</Titulo>
        {subtitulo && <p className="text-base text-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
    </header>
  );
}

const PRINCIPAL =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rosa px-[22px] text-[15px] font-extrabold text-white no-underline shadow-boton hover:bg-rosa-activo hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60";
const SECUNDARIO =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-rosa-palo bg-superficie px-5 text-[15px] font-extrabold text-rosa-oscuro no-underline hover:border-rosa hover:text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60";

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icono?: Icono; a?: string };

function boton(clases: string, trazo: number) {
  return function Boton({ icono: Icono, a, children, className = "", ...props }: BotonProps) {
    const contenido = (
      <>
        {Icono && <Icono tamano={18} trazo={trazo} />}
        {children}
      </>
    );
    if (a) {
      return (
        <Link to={a} className={`${clases} ${className}`}>
          {contenido}
        </Link>
      );
    }
    return (
      <button type="button" className={`${clases} ${className}`} {...props}>
        {contenido}
      </button>
    );
  };
}

/** Botón rosa con sombra: «Nueva venta», «Nuevo modelo». */
export const BotonPrincipal = boton(PRINCIPAL, 2.4);
/** Botón blanco con borde rosa palo: «Registrar compra de insumos». */
export const BotonPastilla = boton(SECUNDARIO, 1.8);

/** Grupo de una sola opción. La elegida va negra (filtros de inventario-mac y pasos de venta-celular). */
export function Pastillas({ etiqueta, opciones, valor, alElegir, alto = "normal" }: { etiqueta: string; opciones: readonly (readonly [string, string])[]; valor: string; alElegir: (v: string) => void; alto?: "normal" | "chico" }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => alElegir(v)}
          className={`${alto === "chico" ? "h-10" : "h-11"} rounded-full border-[1.5px] px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${
            valor === v ? "border-elegido bg-elegido font-extrabold text-sobre-elegido" : "border-borde-campo bg-superficie font-bold text-tinta-media"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Pestañas sobre rosa claro: «Productos en vitrina / Insumos» (inventario-mac). */
export function Pestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: { a: string; texto: string }[] }) {
  return (
    <nav aria-label={etiqueta} className="inline-flex max-w-full overflow-x-auto rounded-full bg-rosa-claro p-[5px]">
      {pestanas.map((p) => (
        <NavLink
          key={p.a}
          to={p.a}
          className={({ isActive }) =>
            `inline-flex min-h-11 shrink-0 items-center rounded-full px-5 text-[15px] no-underline focus-visible:outline-2 focus-visible:outline-rosa ${
              isActive ? "bg-superficie font-extrabold text-rosa-activo shadow-pestana" : "font-bold text-suave hover:text-rosa-activo"
            }`
          }
        >
          {p.texto}
        </NavLink>
      ))}
    </nav>
  );
}

const INSIGNIA = { ok: "bg-ok-fondo text-ok", alerta: "bg-alerta-fondo text-alerta", rosa: "bg-rosa-claro text-rosa-oscuro" };

/** Tarjeta de cifra de inicio-mac: blanca, o rosa claro sin sombra (En vitrina). */
export function TarjetaCifra({ titulo, cifra, detalle, insignia, tono = "blanca" }: { titulo: string; cifra: ReactNode; detalle?: ReactNode; insignia?: { texto: string; tono: keyof typeof INSIGNIA }; tono?: "blanca" | "rosa" }) {
  return (
    <section className={`flex flex-col gap-2.5 rounded-3xl p-[22px] ${tono === "rosa" ? "bg-rosa-claro" : "border border-borde bg-superficie shadow-tarjeta"}`}>
      <h2 className="text-sm font-bold text-suave">{titulo}</h2>
      <p className="text-[30px] leading-tight font-extrabold tracking-[-0.01em]">{cifra}</p>
      {insignia && <span className={`self-start rounded-full px-2.5 py-1 text-[13px] font-extrabold ${INSIGNIA[insignia.tono]}`}>{insignia.texto}</span>}
      {detalle && <span className="text-[13px] font-bold text-suave">{detalle}</span>}
    </section>
  );
}

const ETIQUETAS: Record<EstadoStock, [string, string]> = {
  ok: ["En stock", "bg-ok-fondo text-ok"],
  por_agotarse: ["Por agotarse", "bg-alerta-fondo text-alerta"],
  bajo_minimo: ["Bajo mínimo", "bg-peligro-fondo text-peligro"],
};

export function Etiqueta({ estado }: { estado: EstadoStock }) {
  const [texto, clases] = ETIQUETAS[estado];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs leading-none font-extrabold whitespace-nowrap ${clases}`}>{texto}</span>;
}

/** Fondo y trazo de cada categoría, como las tarjetas sin foto de los mockups. */
const CATEGORIA: Record<string, [string, string]> = {
  crochet: ["bg-rosa-claro", "text-rosa-activo"],
  murano: ["bg-ok-fondo", "text-ok"],
  cristal: ["bg-lila-fondo", "text-lila"],
  otro: ["bg-alerta-fondo", "text-alerta"],
};

/** La foto del producto o, si no tiene, el color de su categoría con el bolso. */
export function FotoProducto({ foto, categoria, nombre, className = "h-[150px]", icono = 56 }: { foto: string | null; categoria: string; nombre: string; className?: string; icono?: number }) {
  const [fondo, tinta] = CATEGORIA[categoria] ?? CATEGORIA.otro;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${fondo} ${tinta} ${className}`}>
      {foto ? <img src={miniatura(foto)} alt={nombre} className="absolute inset-0 h-full w-full object-cover" /> : <IconoBolso tamano={icono} trazo={icono > 40 ? 1.2 : 1.4} />}
    </div>
  );
}
