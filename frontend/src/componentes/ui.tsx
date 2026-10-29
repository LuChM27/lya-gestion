// Piezas de los mockups (docs/mockups/mockups.html) que comparten todas las pantallas.
import { ShoppingBag, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { fechaLarga } from "../formato";
import { miniatura } from "../inventario";

export type EstadoStock = "ok" | "por_agotarse" | "bajo_minimo";

export function Titulo({ children, nivel = 1 }: { children: ReactNode; nivel?: 1 | 2 }) {
  if (nivel === 2) return <h2 className="font-titulo text-xl font-semibold">{children}</h2>;
  return <h1 className="font-titulo text-[26px] leading-tight font-semibold md:text-[40px]">{children}</h1>;
}

/** Fecha pequeña, título en Fraunces, subtítulo y acciones a la derecha. */
export function Encabezado({ fecha = false, titulo, subtitulo, acciones }: { fecha?: boolean; titulo: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {fecha && <p className="mb-1 text-sm font-semibold text-tinta-media">{fechaLarga(new Date().toISOString())}</p>}
        <Titulo>{titulo}</Titulo>
        {subtitulo && <p className="mt-1 text-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

const PRINCIPAL =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rosa px-6 font-extrabold text-white shadow-boton hover:bg-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60";
const PASTILLA =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-borde bg-superficie px-5 font-bold text-rosa-oscuro hover:border-rosa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa disabled:opacity-60";

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icono?: LucideIcon; a?: string };

function contenido(Icono: LucideIcon | undefined, children: ReactNode) {
  return (
    <>
      {Icono && <Icono aria-hidden size={18} strokeWidth={2.2} />}
      {children}
    </>
  );
}

export function BotonPrincipal({ icono, a, children, className = "", ...props }: BotonProps) {
  if (a) return <Link to={a} className={`${PRINCIPAL} ${className}`}>{contenido(icono, children)}</Link>;
  return (
    <button type="button" className={`${PRINCIPAL} ${className}`} {...props}>
      {contenido(icono, children)}
    </button>
  );
}

export function BotonPastilla({ icono, a, children, className = "", ...props }: BotonProps) {
  if (a) return <Link to={a} className={`${PASTILLA} ${className}`}>{contenido(icono, children)}</Link>;
  return (
    <button type="button" className={`${PASTILLA} ${className}`} {...props}>
      {contenido(icono, children)}
    </button>
  );
}

/** Grupo de una sola opción, como «¿Por dónde te compró?»: la elegida va oscura. */
export function Pastillas({ etiqueta, opciones, valor, alElegir }: { etiqueta: string; opciones: readonly (readonly [string, string])[]; valor: string; alElegir: (v: string) => void }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => alElegir(v)}
          className={`h-11 rounded-full border px-4 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa ${
            valor === v ? "border-elegido bg-elegido text-sobre-elegido" : "border-borde bg-superficie text-tinta-media hover:border-rosa"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Pestañas en pastilla rosa claro, como «Productos en vitrina / Insumos». */
export function Pestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: { a: string; texto: string }[] }) {
  return (
    <nav aria-label={etiqueta} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-rosa-claro p-1">
      {pestanas.map((p) => (
        <NavLink
          key={p.a}
          to={p.a}
          className={({ isActive }) =>
            `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-rosa ${
              isActive ? "bg-superficie text-rosa-oscuro shadow-tarjeta" : "text-tinta-media"
            }`
          }
        >
          {p.texto}
        </NavLink>
      ))}
    </nav>
  );
}

const TONOS = {
  normal: "border border-borde bg-superficie",
  rosa: "bg-rosa text-white shadow-boton",
  suave: "bg-rosa-claro",
};

export function TarjetaCifra({ titulo, cifra, detalle, tono = "normal" }: { titulo: string; cifra: ReactNode; detalle?: ReactNode; tono?: keyof typeof TONOS }) {
  return (
    <section className={`rounded-3xl p-5 shadow-tarjeta ${TONOS[tono]}`}>
      <h2 className={`text-sm font-bold ${tono === "rosa" ? "text-white/90" : "text-tinta-media"}`}>{titulo}</h2>
      <p className="my-1 text-[34px] leading-tight font-extrabold md:text-[38px]">{cifra}</p>
      {detalle && <div className="text-sm font-bold">{detalle}</div>}
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
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap ${clases}`}>{texto}</span>;
}

const CATEGORIA: Record<string, [string, string]> = {
  crochet: ["bg-rosa-claro", "text-rosa"],
  murano: ["bg-ok-fondo", "text-ok"],
  cristal: ["bg-lila-fondo", "text-lila"],
  otro: ["bg-alerta-fondo", "text-alerta"],
};

/** La foto del producto o, si no tiene, el color de su categoría con el ícono de bolso. */
export function FotoProducto({ foto, categoria, nombre, className = "" }: { foto: string | null; categoria: string; nombre: string; className?: string }) {
  const [fondo, acento] = CATEGORIA[categoria] ?? CATEGORIA.otro;
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl ${fondo} ${className}`}>
      {foto ? (
        <img src={miniatura(foto)} alt={nombre} className="h-full w-full object-cover" />
      ) : (
        <ShoppingBag aria-hidden className={`absolute inset-0 m-auto ${acento}`} size={34} strokeWidth={1.8} />
      )}
    </div>
  );
}
