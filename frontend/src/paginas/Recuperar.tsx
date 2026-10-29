import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi } from "../api";
import { Boton, Campo, MensajeError, Tarjeta } from "../componentes/Formulario";
import CodigoRecuperacion from "./CodigoRecuperacion";

export default function Recuperar() {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await enviar<{ codigo_recuperacion: string }>("/api/auth/recuperar", {
        codigo: codigo.trim(),
        contrasena_nueva: contrasena,
      });
      setNuevoCodigo(r.codigo_recuperacion);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo={nuevoCodigo ? "Tu nuevo código de recuperación" : "Cambiar contraseña"}>
      {nuevoCodigo ? (
        <CodigoRecuperacion codigo={nuevoCodigo} alContinuar={() => navegar("/entrar", { replace: true })} />
      ) : (
        <form onSubmit={alEnviar} noValidate>
          <Campo etiqueta="Código de recuperación" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => { setCodigo(e.target.value); setError(""); }} />
          <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={contrasena} onChange={(e) => { setContrasena(e.target.value); setError(""); }} />
          <MensajeError texto={error} />
          <Boton type="submit" disabled={enviando}>Cambiar contraseña</Boton>
          <p className="mt-4 text-center text-sm">
            <Link to="/entrar" className="font-semibold text-rosa underline">Volver a entrar</Link>
          </p>
        </form>
      )}
    </Tarjeta>
  );
}
