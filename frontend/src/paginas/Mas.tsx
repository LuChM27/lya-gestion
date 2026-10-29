import { useState } from "react";
import AccesoCelular from "../componentes/AccesoCelular";
import { IconoQr, IconoSalir, IconoSiguiente } from "../componentes/iconos";
import { Titulo } from "../componentes/ui";
import { useSalir } from "../sesion";

// «Más» del celular: lo que en la Mac está al pie del menú lateral. Filas como «Para no olvidar»
// de docs/mockups/fuentes/inicio-celular.html.
const FILA =
  "flex w-full items-center gap-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3 text-left text-tinta focus-visible:outline-2 focus-visible:outline-rosa";
const CUADRO = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rosa-claro text-rosa-activo";

export default function Mas() {
  const salir = useSalir();
  const [celular, setCelular] = useState(false);

  return (
    <>
      <Titulo>Más</Titulo>
      <div className="flex flex-col gap-2.5">
        <button type="button" className={FILA} aria-expanded={celular} onClick={() => setCelular((v) => !v)}>
          <span className={CUADRO}>
            <IconoQr />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-sm font-extrabold">Entrar desde el celular</span>
            <span className="text-xs text-suave">Escanea el código QR</span>
          </span>
          <IconoSiguiente tamano={16} className="shrink-0 text-flecha" />
        </button>
        {celular && (
          <section className="rounded-[22px] border border-borde bg-superficie p-5">
            <AccesoCelular />
          </section>
        )}
        <button type="button" className={FILA} onClick={salir}>
          <span className={CUADRO}>
            <IconoSalir />
          </span>
          <span className="flex-1 text-sm font-extrabold">Salir</span>
        </button>
      </div>
    </>
  );
}
