import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorApi, pedir } from "../api";
import { Campo } from "../componentes/Formulario";
import { hora, pesos } from "../formato";
import { hoyBogota, nombreCanal, resumenItems, type DiaVentas } from "../ventas";

export default function Ventas() {
  const [dia, setDia] = useState(hoyBogota);
  const [datos, setDatos] = useState<DiaVentas | null>(null);
  const [error, setError] = useState("");
  const ultima = useRef(0);

  useEffect(() => {
    if (!dia) return;
    const numero = ++ultima.current;
    pedir<DiaVentas>(`/api/ventas?dia=${dia}`)
      .then((r) => {
        if (numero !== ultima.current) return; // llegó tarde: ya se eligió otro día
        setDatos(r);
        setError("");
      })
      .catch((err) => numero === ultima.current && setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [dia]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Ventas</h1>
        <Link
          to="/vender"
          className="inline-flex h-11 items-center rounded-lg bg-rosa px-4 font-bold text-white hover:bg-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
        >
          Nueva venta
        </Link>
      </div>
      <div className="max-w-xs">
        <Campo etiqueta="Día" type="date" max={hoyBogota()} value={dia} onChange={(e) => setDia(e.target.value || hoyBogota())} />
      </div>
      {error && <p role="alert" className="mb-4 font-semibold text-error">{error}</p>}
      {datos && (
        <>
          <p className="mb-4 text-lg font-bold">
            {`${datos.cantidad} ${datos.cantidad === 1 ? "venta" : "ventas"} · ${pesos(datos.total)}`}
          </p>
          {datos.ventas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-borde p-8 text-center text-suave">No hay ventas este día.</p>
          ) : (
            <ul className="grid gap-3">
              {datos.ventas.map((v) => {
                const anulada = v.estado === "cancelado";
                return (
                  <li key={v.id}>
                    <Link
                      to={`/ventas/${v.id}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-borde bg-superficie p-3 hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{`N.º ${v.numero} · ${hora(v.fecha)} · ${nombreCanal(v.canal)}`}</span>
                        <span className={`block text-sm text-suave ${anulada ? "line-through" : ""}`}>{resumenItems(v)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block font-bold ${anulada ? "line-through" : ""}`}>{pesos(v.total)}</span>
                        {anulada && <span className="text-sm font-semibold text-peligro">Anulada</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
