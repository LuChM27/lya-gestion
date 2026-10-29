import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi } from "../api";
import { Boton, Campo, CampoContrasena, MensajeError, Tarjeta } from "../componentes/Formulario";

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
    <Tarjeta titulo="¡Qué bueno verte!" subtitulo="Entra para ver tus ventas, pedidos e inventario.">
      <form onSubmit={alEnviar} noValidate>
        <Campo etiqueta="Usuario" autoComplete="username" value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }} />
        <CampoContrasena etiqueta="Contraseña" autoComplete="current-password" value={contrasena} onChange={(e) => { setContrasena(e.target.value); setError(""); }} />
        <MensajeError texto={error} />
        <Boton type="submit" disabled={enviando}>Entrar</Boton>
      </form>
      <p className="mt-6 rounded-2xl bg-rosa-claro p-4 text-sm text-tinta-media">
        <strong className="text-tinta">¿Olvidaste tu contraseña?</strong> Usa el código de 8 dígitos que viene en tu guía de instalación.{" "}
        <Link to="/recuperar" className="font-extrabold text-rosa-oscuro underline">Recuperar acceso</Link>
      </p>
    </Tarjeta>
  );
}
