import { useEffect, useState } from "react";
import { ErrorApi, pedir } from "../api";
import { cantidad, fecha } from "../formato";
import { NOMBRE_MOVIMIENTO, type Movimiento } from "../inventario";

export default function Historial({ ruta, unidad }: { ruta: string; unidad?: string }) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<Movimiento[]>(ruta)
      .then(setMovimientos)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  if (error) return <p role="alert" className="mt-2 text-sm font-semibold text-error">{error}</p>;
  if (!movimientos) return null;
  if (movimientos.length === 0) return <p className="mt-2 text-sm text-suave">Todavía no hay movimientos.</p>;
  return (
    <ul className="mt-2 divide-y divide-borde text-sm">
      {movimientos.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-2 py-2">
          <span>
            <span className="block font-semibold">{NOMBRE_MOVIMIENTO[m.tipo] ?? m.tipo}</span>
            <span className="text-suave">{fecha(m.fecha)}</span>
            {m.nota && <span className="block text-suave">{m.nota}</span>}
          </span>
          <span className={`font-bold ${m.cantidad < 0 ? "text-peligro" : ""}`}>
            {(m.cantidad > 0 ? "+" : "") + cantidad(m.cantidad)}
            {unidad && ` ${unidad}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
