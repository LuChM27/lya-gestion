import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorApi, pedir } from "./api";
import CrearCuenta from "./paginas/CrearCuenta";
import Entrar from "./paginas/Entrar";
import Marco from "./componentes/Marco";
import Inicio from "./paginas/Inicio";
import Insumos from "./paginas/Insumos";
import Modelo from "./paginas/Modelo";
import Productos from "./paginas/Productos";
import Recuperar from "./paginas/Recuperar";

type Sesion = { tipo: "cargando" } | { tipo: "sin-cuenta" } | { tipo: "sin-sesion" } | { tipo: "lista"; usuario: string } | { tipo: "error"; mensaje: string };

function Protegida() {
  const [sesion, setSesion] = useState<Sesion>({ tipo: "cargando" });

  useEffect(() => {
    (async () => {
      try {
        const { configurado } = await pedir<{ configurado: boolean }>("/api/auth/estado");
        if (!configurado) return setSesion({ tipo: "sin-cuenta" });
        const { usuario } = await pedir<{ usuario: string }>("/api/auth/yo");
        setSesion({ tipo: "lista", usuario });
      } catch (err) {
        if (err instanceof ErrorApi && err.estado === 401) setSesion({ tipo: "sin-sesion" });
        else setSesion({ tipo: "error", mensaje: err instanceof ErrorApi ? err.mensaje : String(err) });
      }
    })();
  }, []);

  switch (sesion.tipo) {
    case "cargando":
      return null; // la respuesta es local y tarda menos de 100 ms
    case "sin-cuenta":
      return <Navigate to="/crear-cuenta" replace />;
    case "sin-sesion":
      return <Navigate to="/entrar" replace />;
    case "error":
      return <p role="alert" className="p-6 text-error">{sesion.mensaje}</p>;
    case "lista":
      return (
        <Routes>
          <Route element={<Marco />}>
            <Route index element={<Inicio usuario={sesion.usuario} />} />
            <Route path="productos" element={<Productos />} />
            <Route path="productos/:id" element={<Modelo />} />
            <Route path="insumos" element={<Insumos />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      );
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/crear-cuenta" element={<CrearCuenta />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="*" element={<Protegida />} />
    </Routes>
  );
}
