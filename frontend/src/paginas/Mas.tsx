import { LogOut, QrCode } from "lucide-react";
import { useState } from "react";
import AccesoCelular from "../componentes/AccesoCelular";
import { Titulo } from "../componentes/ui";
import { useSalir } from "../sesion";

const FILA =
  "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-borde bg-superficie px-4 text-left font-bold shadow-tarjeta focus-visible:outline-2 focus-visible:outline-rosa";

/** «Más» del celular: lo que en la Mac está al pie del menú lateral. */
export default function Mas() {
  const salir = useSalir();
  const [celular, setCelular] = useState(false);

  return (
    <>
      <div className="mb-6">
        <Titulo>Más</Titulo>
      </div>
      <div className="grid gap-3">
        <button type="button" className={FILA} aria-expanded={celular} onClick={() => setCelular((v) => !v)}>
          <QrCode aria-hidden size={22} className="text-rosa" />
          Entrar desde el celular
        </button>
        {celular && (
          <section className="rounded-3xl border border-borde bg-superficie p-6 shadow-tarjeta">
            <AccesoCelular />
          </section>
        )}
        <button type="button" className={FILA} onClick={salir}>
          <LogOut aria-hidden size={22} className="text-rosa" />
          Salir
        </button>
      </div>
    </>
  );
}
