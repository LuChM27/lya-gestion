import { useNavigate } from "react-router-dom";
import { enviar } from "./api";

/** Cierra la sesión y vuelve a la pantalla de entrar, aunque el servidor no responda. */
export function useSalir() {
  const navegar = useNavigate();
  return async () => {
    await enviar("/api/auth/salir", {}).catch(() => undefined);
    navegar("/entrar", { replace: true });
  };
}
