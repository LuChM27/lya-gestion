import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorApi, pedir } from "../api";
import { Campo } from "../componentes/Formulario";
import { IconoSiguiente, IconoSumar, IconoVentas } from "../componentes/iconos";
import { BotonPrincipal, Encabezado, Vacio } from "../componentes/ui";
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
      <Encabezado
        titulo="Ventas"
        subtitulo={datos && `${datos.cantidad} ${datos.cantidad === 1 ? "venta" : "ventas"} · ${pesos(datos.total)}`}
        acciones={
          <div className="hidden md:block">
            <BotonPrincipal a="/vender" icono={IconoSumar}>
              Nueva venta
            </BotonPrincipal>
          </div>
        }
      />
      <div className="max-w-[260px]">
        <Campo etiqueta="Día" type="date" max={hoyBogota()} value={dia} onChange={(e) => setDia(e.target.value || hoyBogota())} />
      </div>
      {error && <p role="alert" className="font-bold text-error">{error}</p>}
      {datos && datos.ventas.length === 0 && <Vacio texto="No hay ventas este día." />}
      {datos && datos.ventas.length > 0 && (
        <ul className="flex max-w-[720px] flex-col gap-2.5">
          {datos.ventas.map((v) => {
            const anulada = v.estado === "cancelado";
            return (
              <li key={v.id}>
                <Link
                  to={`/ventas/${v.id}`}
                  className="flex items-center gap-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3 text-tinta no-underline hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
                >
                  <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${anulada ? "bg-peligro-fondo text-peligro" : "bg-rosa-claro text-rosa-activo"}`}>
                    <IconoVentas tamano={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-sm font-extrabold">{`N.º ${v.numero} · ${hora(v.fecha)} · ${nombreCanal(v.canal)}`}</span>
                    <span className={`truncate text-xs text-suave ${anulada ? "line-through" : ""}`}>{resumenItems(v)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={`text-sm font-extrabold whitespace-nowrap ${anulada ? "text-suave line-through" : ""}`}>{pesos(v.total)}</span>
                    {anulada && <span className="text-xs font-extrabold text-peligro">Anulada</span>}
                  </span>
                  <IconoSiguiente tamano={16} className="shrink-0 text-flecha" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
