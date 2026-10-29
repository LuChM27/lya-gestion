import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import Confirmar from "../componentes/Confirmar";
import { fecha, hora, pesos } from "../formato";
import { nombreCanal, type Venta as TipoVenta } from "../ventas";

export default function Venta() {
  const { id } = useParams();
  const { state } = useLocation();
  const [venta, setVenta] = useState<TipoVenta | null>(null);
  const [error, setError] = useState("");
  const ruta = `/api/ventas/${id}`;

  useEffect(() => {
    pedir<TipoVenta>(ruta)
      .then(setVenta)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  if (error) return <p role="alert" className="font-semibold text-error">{error}</p>;
  if (!venta) return null;
  const anulada = venta.estado === "cancelado";
  const guardada = (state as { guardada?: boolean } | null)?.guardada && !anulada;

  return (
    <>
      <Link to="/ventas" className="mb-3 inline-flex h-11 items-center font-semibold text-rosa-oscuro underline">
        Volver a ventas
      </Link>
      {guardada && (
        <p role="status" className="mb-4 rounded-2xl border border-menta bg-menta/15 p-4 font-bold">
          Venta guardada
        </p>
      )}
      <section className="mb-6 rounded-2xl border border-borde bg-superficie p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{`Venta N.º ${venta.numero}`}</h1>
          {anulada && <span className="rounded-full bg-peligro-fondo px-3 py-1 text-sm font-bold text-peligro">Anulada</span>}
        </div>
        <p className="text-suave">{`${fecha(venta.fecha)} · ${hora(venta.fecha)} · ${nombreCanal(venta.canal)} · ${venta.cliente}`}</p>
        <ul className="my-4 divide-y divide-borde">
          {venta.items.map((i) => (
            <li key={i.variante_id} className="flex justify-between gap-3 py-2">
              <span>{`${i.modelo} · ${i.color} ×${i.cantidad}`}</span>
              <span className="shrink-0 whitespace-nowrap font-semibold">{pesos(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        {venta.descuento > 0 && (
          <p className="flex justify-between text-suave">
            <span>Descuento</span>
            <span>{`- ${pesos(venta.descuento)}`}</span>
          </p>
        )}
        <p className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-dorado">{pesos(venta.total)}</span>
        </p>
        {venta.cuenta && <p className="mt-1 text-suave">{`Pagado con ${venta.cuenta.nombre}`}</p>}
      </section>
      <div className="mb-8 flex flex-wrap gap-2">
        <a
          href={venta.comprobante}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 items-center rounded-lg bg-rosa px-4 font-bold text-white hover:bg-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
        >
          Ver comprobante
        </a>
        <Link
          to="/vender"
          className="inline-flex h-11 items-center rounded-lg border border-borde bg-superficie px-4 font-semibold hover:bg-rosa-palo/40 focus-visible:outline-2 focus-visible:outline-rosa"
        >
          Nueva venta
        </Link>
      </div>
      {!anulada && (
        <Confirmar
          boton="Anular venta"
          pregunta={`¿Anular la venta N.º ${venta.numero}? Las unidades vuelven a la vitrina${
            venta.cuenta ? ` y se quita el ingreso de ${venta.cuenta.nombre}` : ""
          }.`}
          accion="Anular"
          alConfirmar={async () => setVenta(await enviar<TipoVenta>(`${ruta}/anular`, {}))}
        />
      )}
    </>
  );
}
