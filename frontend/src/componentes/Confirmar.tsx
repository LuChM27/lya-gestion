import { useState } from "react";
import { ErrorApi } from "../api";
import { BotonSecundario, MensajeError } from "./Formulario";

/** Acción delicada con confirmación en la misma pantalla, sin diálogos del navegador. */
export default function Confirmar({
  boton,
  pregunta,
  accion,
  alConfirmar,
}: {
  boton: string;
  pregunta: string;
  accion: string;
  alConfirmar: () => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    try {
      await alConfirmar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  if (!confirmando) {
    return <BotonSecundario onClick={() => setConfirmando(true)}>{boton}</BotonSecundario>;
  }
  return (
    <div className="rounded-2xl border border-peligro bg-peligro-fondo p-4">
      <p className="mb-3 font-semibold">{pregunta}</p>
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          className="h-11 rounded-lg bg-peligro px-4 font-bold text-sobre-peligro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro"
        >
          {accion}
        </button>
        <BotonSecundario onClick={() => setConfirmando(false)}>Cancelar</BotonSecundario>
      </div>
    </div>
  );
}
