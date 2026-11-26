import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import Confirmar from "../componentes/Confirmar";
import { Boton, Campo, MensajeError } from "../componentes/Formulario";
import { IconoVolver } from "../componentes/iconos";
import { Pastillas, Titulo } from "../componentes/ui";
import type { Compra as TipoCompra } from "../dinero";
import { cantidad, fecha, pesos, precio } from "../formato";
import { hoyBogota, type Cuenta } from "../ventas";

// Detalle de una compra con las piezas del detalle de venta (venta-celular.html).
export default function Compra() {
  const { id } = useParams();
  const [compra, setCompra] = useState<TipoCompra | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuenta, setCuenta] = useState("");
  const hoy = hoyBogota();
  const [dia, setDia] = useState(hoy);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ruta = `/api/compras/${id}`;

  useEffect(() => {
    Promise.all([pedir<TipoCompra>(ruta), pedir<Cuenta[]>("/api/cuentas")])
      .then(([c, lista]) => (setCompra(c), setCuentas(lista)))
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  async function pagar() {
    if (enviando) return;
    if (!cuenta) return setError("Elige de qué cuenta salió.");
    setEnviando(true);
    try {
      setCompra(await enviar<TipoCompra>(`${ruta}/pago`, { cuenta_id: Number(cuenta), fecha: dia === hoy ? null : dia }));
      setError("");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      // Otro equipo pudo pagarla o anularla: se trae como quedó.
      if (err instanceof ErrorApi && err.estado === 409) pedir<TipoCompra>(ruta).then(setCompra, () => undefined);
    } finally {
      setEnviando(false);
    }
  }

  if (!compra) return error ? <p role="alert" className="font-bold text-error">{error}</p> : null;
  const anulada = compra.estado === "anulada";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <Link to="/compras" className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline">
        <IconoVolver tamano={18} />
        Volver a compras
      </Link>
      <section className="flex flex-col gap-3 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:p-[26px]">
        <div className="flex flex-wrap items-center gap-3">
          <Titulo>{`Compra N.º ${compra.numero}`}</Titulo>
          {anulada ? (
            <span className="rounded-full bg-peligro-fondo px-2.5 py-1 text-xs font-extrabold text-peligro">Anulada</span>
          ) : (
            !compra.cuenta && <span className="rounded-full bg-alerta-fondo px-2.5 py-1 text-xs font-extrabold text-alerta">Sin pagar</span>
          )}
        </div>
        <p className="text-sm text-suave">{`${fecha(compra.fecha)}${compra.proveedor ? ` · ${compra.proveedor}` : ""}`}</p>
        <ul className="divide-y divide-borde">
          {compra.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-3 text-sm">
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{i.insumo}</span>
                <span className="text-xs text-suave">{`${cantidad(i.cantidad)} ${i.unidad} × ${precio(i.precio_unitario)}`}</span>
              </span>
              <span className="shrink-0 font-extrabold whitespace-nowrap">{pesos(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-borde pt-3">
          <span className="text-base font-extrabold">Total</span>
          <span className="text-[26px] font-extrabold text-dorado">{pesos(compra.total)}</span>
        </div>
        {compra.cuenta && compra.pagada_el && <p className="text-sm font-bold text-ok">{`Pagada con ${compra.cuenta.nombre} el ${fecha(compra.pagada_el)}`}</p>}
        {compra.cuenta && <MensajeError texto={error} />}
      </section>

      {!anulada && !compra.cuenta && (
        <section aria-label="Registrar pago" className="flex flex-col gap-3 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:p-[26px]">
          <h2 className="text-[17px] font-extrabold md:text-[19px]">¿Ya la pagaste?</h2>
          <Pastillas etiqueta="¿De dónde salió?" opciones={cuentas.map((c) => [String(c.id), c.nombre] as const)} valor={cuenta} alElegir={(v) => (setCuenta(v), setError(""))} />
          <div className="max-w-[260px]">
            <Campo etiqueta="Fecha del pago" type="date" value={dia} max={hoy} onChange={(e) => setDia(e.target.value || hoy)} />
          </div>
          <MensajeError texto={error} />
          <Boton onClick={pagar} disabled={enviando} className="sm:w-auto sm:self-start">
            Guardar pago
          </Boton>
        </section>
      )}

      {!anulada && (
        <Confirmar
          boton="Anular compra"
          pregunta={`¿Anular la compra N.º ${compra.numero}? Los insumos salen del inventario y el pago se borra.`}
          accion="Anular"
          alConfirmar={async () => setCompra(await enviar<TipoCompra>(`${ruta}/anular`, {}))}
        />
      )}
    </div>
  );
}
