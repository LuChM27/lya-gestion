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
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (ocupado) return; // un doble toque no debe repetir la acción
    setOcupado(true);
    try {
      await alConfirmar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setOcupado(false);
    }
  }

  if (!confirmando) {
    return <BotonSecundario onClick={() => setConfirmando(true)}>{boton}</BotonSecundario>;
  }
  return (
    <div className="rounded-[22px] bg-peligro-fondo p-4">
      <p className="mb-3 text-sm leading-normal font-bold text-tinta">{pregunta}</p>
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={ocupado}
          className="h-11 rounded-full bg-peligro px-5 text-[15px] font-extrabold text-sobre-peligro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peligro disabled:opacity-60"
        >
          {accion}
        </button>
        <BotonSecundario onClick={() => setConfirmando(false)}>Cancelar</BotonSecundario>
      </div>
    </div>
  );
}
