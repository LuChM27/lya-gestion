import { House, LogOut, Menu, Package, Plus, QrCode, ShoppingBag, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useSalir } from "../sesion";
import AccesoCelular from "./AccesoCelular";

// Diseño de «Inicio · Mac» (menú lateral) e «Inicio · Celular» (encabezado y barra inferior).
// Solo se muestran las secciones que ya existen; Pedidos, Clientes y demás llegan con su módulo.
type Seccion = { a: string; texto: string; icono: LucideIcon; activa: (ruta: string) => boolean };

const INICIO: Seccion = { a: "/", texto: "Inicio", icono: House, activa: (r) => r === "/" };
const VENTAS: Seccion = { a: "/ventas", texto: "Ventas", icono: ShoppingBag, activa: (r) => r.startsWith("/ventas") };
const INVENTARIO: Seccion = {
  a: "/inventario",
  texto: "Inventario",
  icono: Package,
  activa: (r) => ["/inventario", "/productos", "/insumos"].some((p) => r.startsWith(p)),
};
const MAS: Seccion = { a: "/mas", texto: "Más", icono: Menu, activa: (r) => r.startsWith("/mas") };

function Logo({ tamano }: { tamano: string }) {
  return <img src="/logo.webp" alt="L&A Tejidos" className={`${tamano} rounded-full object-cover ring-4 ring-white`} />;
}

function MenuLateral({ ruta }: { ruta: string }) {
  const salir = useSalir();
  const [celular, setCelular] = useState(false);

  return (
    <aside className="fixed inset-y-4 left-4 hidden w-60 flex-col rounded-[28px] bg-rosa-claro p-5 md:flex">
      <div className="mb-6 flex justify-center">
        <Logo tamano="h-36 w-36" />
      </div>
      <nav aria-label="Menú" className="grid gap-1">
        {[INICIO, VENTAS, INVENTARIO].map((s) => {
          const activa = s.activa(ruta);
          return (
            <Link
              key={s.a}
              to={s.a}
              aria-current={activa ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-2xl px-4 font-bold focus-visible:outline-2 focus-visible:outline-rosa ${
                activa ? "bg-superficie text-rosa-oscuro shadow-tarjeta" : "text-tinta-media hover:bg-superficie/60"
              }`}
            >
              <s.icono aria-hidden size={20} strokeWidth={1.8} />
              {s.texto}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-2">
        <button
          type="button"
          aria-expanded={celular}
          onClick={() => setCelular((v) => !v)}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-rosa-palo p-3 text-left text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-rosa"
        >
          <QrCode aria-hidden size={22} className="shrink-0 text-rosa" />
          Entrar desde el celular
        </button>
        {celular && (
          <div className="rounded-2xl bg-superficie p-3 text-sm">
            <AccesoCelular />
          </div>
        )}
        <button
          type="button"
          onClick={salir}
          className="flex h-11 items-center gap-3 rounded-2xl px-4 font-bold text-tinta-media hover:bg-superficie/60 focus-visible:outline-2 focus-visible:outline-rosa"
        >
          <LogOut aria-hidden size={20} strokeWidth={1.8} />
          Salir
        </button>
      </div>
    </aside>
  );
}

function BarraInferior({ ruta }: { ruta: string }) {
  const enlace = (s: Seccion) => {
    const activa = s.activa(ruta);
    return (
      <Link
        key={s.a}
        to={s.a}
        aria-current={activa ? "page" : undefined}
        className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-rosa ${
          activa ? "text-rosa-oscuro" : "text-suave"
        }`}
      >
        <s.icono aria-hidden size={22} strokeWidth={1.8} />
        {s.texto}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-1 rounded-[28px] bg-superficie px-2 py-1.5 shadow-tarjeta ring-1 ring-borde md:hidden"
    >
      {enlace(INICIO)}
      {enlace(VENTAS)}
      <Link
        to="/vender"
        aria-label="Nueva venta"
        className="-mt-9 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-rosa text-white shadow-boton ring-4 ring-fondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
      >
        <Plus aria-hidden size={30} strokeWidth={2.4} />
      </Link>
      {enlace(INVENTARIO)}
      {enlace(MAS)}
    </nav>
  );
}

export default function Marco() {
  const { pathname } = useLocation();
  // La venta rápida va a pantalla completa en el celular, con su propio botón de volver.
  const pantallaCompleta = pathname === "/vender";

  return (
    <div className={`min-h-dvh md:pl-68 ${pantallaCompleta ? "" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0"}`}>
      <MenuLateral ruta={pathname} />
      {!pantallaCompleta && (
        <header className="flex items-center gap-3 px-4 pt-4 md:hidden">
          <Logo tamano="h-10 w-10" />
          <span className="font-titulo text-2xl font-semibold text-rosa-oscuro italic">L&amp;A</span>
        </header>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
      {!pantallaCompleta && <BarraInferior ruta={pathname} />}
    </div>
  );
}
