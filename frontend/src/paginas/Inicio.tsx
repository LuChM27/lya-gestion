import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { enviar } from "../api";
import AccesoCelular from "../componentes/AccesoCelular";
import { Boton } from "../componentes/Formulario";

export default function Inicio({ usuario }: { usuario: string }) {
  const navegar = useNavigate();
  const [verCelular, setVerCelular] = useState(false);

  async function salir() {
    await enviar("/api/auth/salir", {});
    navegar("/entrar", { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between bg-rosa-palo px-4 py-3">
        <span className="text-2xl font-bold text-rosa-oscuro">L&amp;A</span>
        <button onClick={salir} className="h-11 rounded-lg px-4 font-semibold hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-rosa">
          Salir
        </button>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Hola, {usuario}</h1>
        <p className="mb-6 text-suave">Aquí irán inventario, ventas y cuentas.</p>
        <div className="max-w-xs">
          <Boton onClick={() => setVerCelular((v) => !v)} aria-expanded={verCelular}>
            Entrar desde el celular
          </Boton>
        </div>
        {verCelular && (
          <section className="mt-6 rounded-2xl border border-borde bg-superficie p-6">
            <AccesoCelular />
          </section>
        )}
      </main>
    </div>
  );
}
