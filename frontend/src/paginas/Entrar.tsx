import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi } from "../api";
import { Boton, Campo, MensajeError, Tarjeta } from "../componentes/Formulario";

export default function Entrar() {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await enviar("/api/auth/entrar", { usuario, contrasena });
      navegar("/", { replace: true });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Entrar a L&A">
      <form onSubmit={alEnviar} noValidate>
        <Campo etiqueta="Usuario" autoComplete="username" value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }} />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={contrasena} onChange={(e) => { setContrasena(e.target.value); setError(""); }} />
        <MensajeError texto={error} />
        <Boton type="submit" disabled={enviando}>Entrar</Boton>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/recuperar" className="font-semibold text-rosa underline">Olvidé mi contraseña</Link>
      </p>
    </Tarjeta>
  );
}
