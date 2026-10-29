import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { enviar, ErrorApi } from "../api";
import { Boton, Campo, CampoContrasena, MensajeError, Tarjeta } from "../componentes/Formulario";
import CodigoRecuperacion from "./CodigoRecuperacion";

export default function CrearCuenta() {
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await enviar<{ codigo_recuperacion: string }>("/api/auth/configurar", { usuario, contrasena });
      setCodigo(r.codigo_recuperacion);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo={codigo ? "Tu código de recuperación" : "Crea tu cuenta"} subtitulo={codigo ? undefined : "Así solo tú entras a tus ventas e inventario."}>
      {codigo ? (
        <CodigoRecuperacion codigo={codigo} alContinuar={() => navegar("/", { replace: true })} />
      ) : (
        <form onSubmit={alEnviar} noValidate>
          <Campo etiqueta="Usuario" autoComplete="username" value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }} />
          <CampoContrasena etiqueta="Contraseña" autoComplete="new-password" minLength={8} value={contrasena} onChange={(e) => { setContrasena(e.target.value); setError(""); }} />
          <p className="-mt-2 mb-4 text-sm text-suave">Al menos 8 caracteres.</p>
          <MensajeError texto={error} />
          <Boton type="submit" disabled={enviando}>Crear cuenta</Boton>
        </form>
      )}
    </Tarjeta>
  );
}
