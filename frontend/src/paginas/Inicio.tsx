import { useState } from "react";
import AccesoCelular from "../componentes/AccesoCelular";
import { Boton } from "../componentes/Formulario";

export default function Inicio({ usuario }: { usuario: string }) {
  const [verCelular, setVerCelular] = useState(false);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Hola, {usuario}</h1>
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
    </>
  );
}
