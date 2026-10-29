import { useState } from "react";
import { ErrorApi } from "../api";
import { BotonSecundario, MensajeError } from "./Formulario";

/** Archivar con confirmación en la misma pantalla, sin diálogos del navegador. */
export default function Archivar({ boton, nombre, alArchivar }: { boton: string; nombre: string; alArchivar: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");

  async function archivar() {
    try {
      await alArchivar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  if (!confirmando) {
    return <BotonSecundario onClick={() => setConfirmando(true)}>{boton}</BotonSecundario>;
  }
  return (
    <div className="rounded-2xl border border-peligro bg-peligro-fondo p-4">
      <p className="mb-3 font-semibold">¿Archivar {nombre}? Sus ventas y movimientos se conservan.</p>
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={archivar}
          className="h-11 rounded-lg bg-peligro px-4 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro"
        >
          Archivar
        </button>
        <BotonSecundario onClick={() => setConfirmando(false)}>Cancelar</BotonSecundario>
      </div>
    </div>
  );
}
