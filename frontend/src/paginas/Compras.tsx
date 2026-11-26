import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorApi, pedir } from "../api";
import { IconoSiguiente, IconoSumar, IconoVentas, IconoVolver } from "../componentes/iconos";
import { BotonPrincipal, Encabezado, Vacio } from "../componentes/ui";
import type { Compra } from "../dinero";
import { fecha, pesos } from "../formato";

// Lista de compras con las filas de Ventas (docs/mockups/fuentes/inicio-celular.html, «Para no olvidar»).
export default function Compras() {
  const [compras, setCompras] = useState<Compra[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<Compra[]>("/api/compras").then(setCompras, (err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/cuentas" className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline">
        <IconoVolver tamano={18} />
        Volver a Mis cuentas
      </Link>
      <Encabezado
        titulo="Compras de insumos"
        subtitulo={compras ? `${compras.filter((c) => c.estado === "activa" && !c.cuenta).length} sin pagar` : undefined}
        acciones={
          <BotonPrincipal icono={IconoSumar} a="/compras/nueva">
            Registrar compra
          </BotonPrincipal>
        }
      />
      {error && (
        <p role="alert" className="font-bold text-error">
          {error}
        </p>
      )}
      {compras?.length === 0 ? (
        <Vacio texto="Todavía no has registrado compras." />
      ) : (
        <ul className="flex max-w-[720px] flex-col gap-2.5">
          {compras?.map((c) => {
            const anulada = c.estado === "anulada";
            return (
              <li key={c.id}>
                <Link
                  to={`/compras/${c.id}`}
                  className="flex items-center gap-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3 text-tinta no-underline hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
                >
                  <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${anulada ? "bg-peligro-fondo text-peligro" : "bg-rosa-claro text-rosa-activo"}`}>
                    <IconoVentas />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-sm font-extrabold">{`N.º ${c.numero} · ${fecha(c.fecha)}${c.proveedor ? ` · ${c.proveedor}` : ""}`}</span>
                    <span className={`truncate text-xs text-suave ${anulada ? "line-through" : ""}`}>{c.items.map((i) => i.insumo).join(", ")}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={`text-sm font-extrabold whitespace-nowrap ${anulada ? "text-suave line-through" : ""}`}>{pesos(c.total)}</span>
                    {anulada ? (
                      <span className="text-xs font-extrabold text-peligro">Anulada</span>
                    ) : c.cuenta ? (
                      <span className="text-xs font-bold text-suave">{c.cuenta.nombre}</span>
                    ) : (
                      <span className="text-xs font-extrabold text-alerta">Sin pagar</span>
                    )}
                  </span>
                  <IconoSiguiente tamano={16} className="shrink-0 text-flecha" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
