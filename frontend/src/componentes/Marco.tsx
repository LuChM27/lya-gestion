import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { enviar } from "../api";

const SECCIONES = [
  { a: "/", texto: "Inicio" },
  { a: "/vender", texto: "Vender" },
  { a: "/productos", texto: "Productos" },
  { a: "/insumos", texto: "Insumos" },
];

const enlace = ({ isActive }: { isActive: boolean }) =>
  `flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-sm font-semibold md:flex-none md:px-3 md:text-base md:justify-start focus-visible:outline-2 focus-visible:outline-rosa ${
    isActive ? "bg-rosa text-white" : "hover:bg-rosa-palo/60"
  }`;

export default function Marco() {
  const navegar = useNavigate();

  async function salir() {
    await enviar("/api/auth/salir", {}).catch(() => undefined);
    navegar("/entrar", { replace: true });
  }

  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-52">
      <header className="flex items-center justify-between bg-rosa-palo px-4 py-3">
        <span className="text-2xl font-bold text-rosa-oscuro">L&amp;A</span>
        <button onClick={salir} className="h-11 rounded-lg px-4 font-semibold hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-rosa">
          Salir
        </button>
      </header>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-10 flex gap-1 border-t border-borde bg-superficie p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:inset-y-0 md:left-0 md:right-auto md:w-52 md:flex-col md:border-t-0 md:border-r md:pt-20"
      >
        {SECCIONES.map((s) => (
          <NavLink key={s.a} to={s.a} end={s.a === "/"} className={enlace}>
            {s.texto}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
