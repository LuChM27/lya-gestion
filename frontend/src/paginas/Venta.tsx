import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import Confirmar from "../componentes/Confirmar";
import { IconoListo, IconoVolver } from "../componentes/iconos";
import { Titulo } from "../componentes/ui";
import { fecha, hora, pesos } from "../formato";
import { nombreCanal, type Venta as TipoVenta } from "../ventas";

// Confirmación copiada de «¡Venta guardada!» en docs/mockups/fuentes/venta-celular.html.
const BOTON_SECUNDARIO =
  "flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-rosa-palo bg-superficie px-6 text-base font-extrabold text-rosa-oscuro no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa";
const BOTON_PRINCIPAL =
  "flex h-[52px] items-center justify-center rounded-full bg-rosa px-6 text-base font-extrabold text-white no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa";

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

  if (error) return <p role="alert" className="font-bold text-error">{error}</p>;
  if (!venta) return null;
  const anulada = venta.estado === "cancelado";
  const guardada = (state as { guardada?: boolean } | null)?.guardada && !anulada;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      {guardada ? (
        <section role="status" className="flex flex-col items-center gap-3.5 rounded-[32px] bg-superficie px-6 pt-7 pb-[26px] text-center shadow-tarjeta">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ok-fondo text-ok">
            <IconoListo tamano={36} trazo={2.4} />
          </span>
          <h2 className="font-titulo text-[26px] font-semibold">¡Venta guardada!</h2>
          <p className="text-[15px] leading-normal text-suave">
            {venta.cuenta ? `${pesos(venta.total)} entraron a ${venta.cuenta.nombre} y el inventario ya se descontó.` : "La venta quedó guardada y el inventario ya se descontó."}
          </p>
          <div className="mt-1 flex w-full flex-col gap-2.5">
            <a href={venta.comprobante} target="_blank" rel="noopener" className={BOTON_SECUNDARIO}>
              Ver comprobante PDF
            </a>
            <Link to="/vender" className={BOTON_PRINCIPAL}>
              Otra venta
            </Link>
          </div>
        </section>
      ) : (
        <Link to="/ventas" className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline">
          <IconoVolver tamano={18} />
          Volver a ventas
        </Link>
      )}

      <section className="flex flex-col gap-3 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:p-[26px]">
        <div className="flex flex-wrap items-center gap-3">
          <Titulo nivel={guardada ? 2 : 1}>{`Venta N.º ${venta.numero}`}</Titulo>
          {anulada && <span className="rounded-full bg-peligro-fondo px-2.5 py-1 text-xs font-extrabold text-peligro">Anulada</span>}
        </div>
        <p className="text-sm text-suave">{`${fecha(venta.fecha)} · ${hora(venta.fecha)} · ${nombreCanal(venta.canal)} · ${venta.cliente}`}</p>
        <ul className="divide-y divide-borde">
          {venta.items.map((i) => (
            <li key={i.variante_id} className="flex justify-between gap-3 py-3 text-sm">
              <span className="font-bold">{`${i.modelo} · ${i.color} ×${i.cantidad}`}</span>
              <span className="shrink-0 font-extrabold whitespace-nowrap">{pesos(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        {venta.descuento > 0 && (
          <p className="flex justify-between text-sm text-suave">
            <span>Descuento</span>
            <span>{`- ${pesos(venta.descuento)}`}</span>
          </p>
        )}
        <p className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-suave">Total</span>
          <span className="text-[26px] font-extrabold tracking-[-0.01em]">{pesos(venta.total)}</span>
        </p>
        {venta.cuenta && <p className="text-sm text-suave">{`Pagado con ${venta.cuenta.nombre}`}</p>}
      </section>

      {!guardada && (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <a href={venta.comprobante} target="_blank" rel="noopener" className={BOTON_SECUNDARIO}>
            Ver comprobante PDF
          </a>
          <Link to="/vender" className={BOTON_PRINCIPAL}>
            Otra venta
          </Link>
        </div>
      )}

      {!anulada && (
        <Confirmar
          boton="Anular venta"
          pregunta={`¿Anular la venta N.º ${venta.numero}? Las unidades vuelven a la vitrina${venta.cuenta ? ` y se quita el ingreso de ${venta.cuenta.nombre}` : ""}.`}
          accion="Anular"
          alConfirmar={async () => setVenta(await enviar<TipoVenta>(`${ruta}/anular`, {}))}
        />
      )}
    </div>
  );
}
