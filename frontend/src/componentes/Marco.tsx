import { useState, type ComponentType } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useSalir } from "../sesion";
import AccesoCelular from "./AccesoCelular";
import { IconoInicio, IconoInventario, IconoMas, IconoQr, IconoSalir, IconoSumar, IconoVentas } from "./iconos";

// Menú lateral de docs/mockups/fuentes/inicio-mac.html; encabezado y barra de inicio-celular.html.
// Solo se muestran las secciones que ya existen; Pedidos, Clientes y demás llegan con su módulo.
type Seccion = { a: string; texto: string; icono: ComponentType<{ tamano?: number; trazo?: number }>; activa: (ruta: string) => boolean };

const INICIO: Seccion = { a: "/", texto: "Inicio", icono: IconoInicio, activa: (r) => r === "/" };
const VENTAS: Seccion = { a: "/ventas", texto: "Ventas", icono: IconoVentas, activa: (r) => r.startsWith("/ventas") };
const INVENTARIO: Seccion = {
  a: "/inventario",
  texto: "Inventario",
  icono: IconoInventario,
  activa: (r) => ["/inventario", "/productos", "/insumos"].some((p) => r.startsWith(p)),
};
const MAS: Seccion = { a: "/mas", texto: "Más", icono: IconoMas, activa: (r) => r.startsWith("/mas") };

function MenuLateral({ ruta }: { ruta: string }) {
  const salir = useSalir();
  const [celular, setCelular] = useState(false);

  return (
    <div className="fixed inset-y-0 left-0 hidden w-[264px] pt-5 pr-4 pb-5 pl-5 md:block">
      <div className="flex h-full flex-col gap-6 overflow-y-auto rounded-[28px] bg-rosa-claro px-4 py-6">
        <div className="flex justify-center pt-1">
          <img src="/logo.webp" alt="L&A Tejidos" width={148} height={148} className="block h-[148px] w-[148px] rounded-full border-4 border-white shadow-logo" />
        </div>
        <nav aria-label="Menú" className="flex flex-col gap-1">
          {[INICIO, VENTAS, INVENTARIO].map((s) => {
            const activa = s.activa(ruta);
            return (
              <Link
                key={s.a}
                to={s.a}
                aria-current={activa ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] no-underline focus-visible:outline-2 focus-visible:outline-rosa ${
                  activa ? "bg-superficie font-extrabold text-rosa-activo shadow-menu" : "font-bold text-tinta-media hover:text-rosa-activo"
                }`}
              >
                <s.icono />
                {s.texto}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={celular}
            onClick={() => setCelular((v) => !v)}
            className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-rosa-palo bg-superficie p-4 text-left text-tinta focus-visible:outline-2 focus-visible:outline-rosa"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rosa-claro text-rosa-activo">
              <IconoQr tamano={22} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-extrabold">Entrar desde el celular</span>
              <span className="text-xs text-suave">Escanea el código QR</span>
            </span>
          </button>
          {celular && (
            <div className="rounded-[20px] bg-superficie p-4 text-sm">
              <AccesoCelular />
            </div>
          )}
          <button
            type="button"
            onClick={salir}
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-bold text-tinta-media hover:text-rosa-activo focus-visible:outline-2 focus-visible:outline-rosa"
          >
            <IconoSalir />
            Salir
          </button>
        </div>
      </div>
    </div>
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
        className={`flex min-w-14 flex-col items-center gap-0.5 py-1.5 text-[11px] no-underline focus-visible:outline-2 focus-visible:outline-rosa ${
          activa ? "font-extrabold text-rosa-activo" : "font-bold text-suave"
        }`}
      >
        <s.icono tamano={22} trazo={activa ? 2 : 1.8} />
        {s.texto}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-20 flex h-[72px] items-center justify-around rounded-[26px] bg-superficie px-1.5 shadow-barra md:hidden"
    >
      {enlace(INICIO)}
      {enlace(VENTAS)}
      <Link
        to="/vender"
        aria-label="Nueva venta"
        className="-mt-[30px] flex h-[60px] w-[60px] items-center justify-center rounded-full border-[5px] border-fondo bg-rosa text-white no-underline shadow-mas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
      >
        <IconoSumar tamano={26} trazo={2.6} />
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
    <div className="min-h-dvh bg-fondo">
      <MenuLateral ruta={pathname} />
      <div className={`md:ml-[264px] ${pantallaCompleta ? "" : "pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-0"}`}>
        {!pantallaCompleta && (
          <header className="flex h-12 items-center gap-2.5 px-5 pt-5 md:hidden">
            <img src="/logo.webp" alt="" width={44} height={44} className="block h-11 w-11 rounded-full border-2 border-white shadow-logo-chico" />
            <span className="font-titulo text-2xl font-semibold text-rosa-activo italic">L&amp;A</span>
          </header>
        )}
        <main className={`${pantallaCompleta ? "px-5 pt-4" : "px-5 pt-6"} md:pt-9 md:pr-10 md:pb-12 md:pl-6`}>
          <div className="flex max-w-[1120px] flex-col gap-4 md:gap-7">
            <Outlet />
          </div>
        </main>
      </div>
      {!pantallaCompleta && <BarraInferior ruta={pathname} />}
    </div>
  );
}
