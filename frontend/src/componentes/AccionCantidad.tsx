import { useState, type FormEvent } from "react";
import { ErrorApi } from "../api";
import { leerNumero } from "../formato";
import { NUMERO_INVALIDO } from "../inventario";
import { Boton, BotonSecundario, Campo, MensajeError } from "./Formulario";

/** Formulario corto en la misma tarjeta: una cantidad y Guardar/Cancelar. */
export default function AccionCantidad({
  etiqueta,
  children,
  alGuardar,
  alCancelar,
}: {
  etiqueta: string;
  children?: React.ReactNode;
  alGuardar: (cantidad: number) => Promise<void>;
  alCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const n = leerNumero(texto);
    if (n === null || n < 0) return setError(NUMERO_INVALIDO);
    setEnviando(true);
    try {
      await alGuardar(n);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="mt-3 rounded-xl bg-fondo p-3">
      <Campo etiqueta={etiqueta} inputMode="decimal" autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setError(""); }} />
      {children}
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>Guardar</Boton>
        <BotonSecundario onClick={alCancelar}>Cancelar</BotonSecundario>
      </div>
    </form>
  );
}
