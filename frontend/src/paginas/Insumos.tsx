import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import FormularioInsumo from "../componentes/FormularioInsumo";
import { IconoSumar } from "../componentes/iconos";
import { BotonPastilla, BotonPrincipal, Buscador, Etiqueta, Pastillas, Vacio } from "../componentes/ui";
import { cantidad, precio } from "../formato";
import { TIPOS_INSUMO, type Insumo } from "../inventario";
import Inventario from "./Inventario";

// Pestaña «Insumos»: la tabla de «Insumos para revisar» de docs/mockups/fuentes/inventario-mac.html.
// En producción, Reservado y Disponible llegan con la producción (fase 2).
const CELDA = "px-2 py-3";

export default function Insumos() {
  const navegar = useNavigate();
  const [insumos, setInsumos] = useState<Insumo[] | null>(null);
  const [buscar, setBuscar] = useState("");
  const [tipo, setTipo] = useState("");
  const [creando, setCreando] = useState(false);
  const [archivados, setArchivados] = useState(false);
  const [error, setError] = useState("");
  const ultima = useRef(0);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (buscar.trim()) parametros.set("buscar", buscar.trim());
    if (tipo) parametros.set("tipo", tipo);
    if (archivados) parametros.set("archivados", "true");
    const consulta = parametros.toString();
    const numero = ++ultima.current;
    pedir<Insumo[]>(`/api/inventario/insumos${consulta ? `?${consulta}` : ""}`)
      .then((r) => {
        if (numero !== ultima.current) return; // llegó tarde: ya se escribió otra búsqueda
        setInsumos(r);
        setError("");
      })
      .catch((err) => {
        if (numero === ultima.current) setError(err instanceof ErrorApi ? err.mensaje : String(err));
      });
  }, [buscar, tipo, archivados]);

  const filtrando = buscar.trim() !== "" || tipo !== "" || archivados;
  const hayLista = insumos?.length !== 0 || filtrando;

  return (
    <Inventario
      acciones={
        !creando && (
          <BotonPrincipal icono={IconoSumar} onClick={() => setCreando(true)}>
            Nuevo insumo
          </BotonPrincipal>
        )
      }
      filtros={hayLista && <Pastillas etiqueta="Tipo" opciones={[["", "Todos"] as const, ...TIPOS_INSUMO]} valor={tipo} alElegir={setTipo} alto="chico" />}
    >
      {creando && (
        <FormularioInsumo
          alCancelar={() => setCreando(false)}
          alGuardar={async (datos) => {
            const i = await enviar<Insumo>("/api/inventario/insumos", datos);
            navegar(`/insumos/${i.id}`);
          }}
        />
      )}
      {!creando && (
        <div className="flex flex-wrap items-center gap-3">
          {hayLista && <Buscador valor={buscar} alCambiar={setBuscar} placeholder="Buscar insumo o proveedor" />}
          <BotonPastilla onClick={() => setArchivados((a) => !a)} aria-pressed={archivados} className="h-10 px-4 text-sm">
            {archivados ? "Ver activos" : "Ver archivados"}
          </BotonPastilla>
        </div>
      )}
      {error && <p role="alert" className="font-bold text-error">{error}</p>}
      {insumos?.length === 0 && !filtrando && !creando && (
        <Vacio texto="Todavía no hay insumos.">
          <BotonPrincipal icono={IconoSumar} onClick={() => setCreando(true)}>
            Crear el primer insumo
          </BotonPrincipal>
        </Vacio>
      )}
      {insumos?.length === 0 && filtrando && (
        <Vacio texto={archivados && !buscar.trim() ? "No hay insumos archivados." : buscar.trim() ? `No hay insumos que coincidan con “${buscar.trim()}”.` : "No hay insumos de este tipo."}>
          <BotonPastilla onClick={() => { setBuscar(""); setTipo(""); setArchivados(false); }}>
            {buscar.trim() ? "Borrar búsqueda" : "Ver todos"}
          </BotonPastilla>
        </Vacio>
      )}
      {insumos && insumos.length > 0 && (
        <section className="rounded-[28px] border border-borde bg-superficie px-4 py-5 shadow-tarjeta md:px-[26px] md:py-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[13px] text-suave [&>th]:py-2.5">
                  <th scope="col" className={`${CELDA} font-extrabold`}>Insumo</th>
                  <th scope="col" className={`${CELDA} text-right font-extrabold`}>Existencia</th>
                  <th scope="col" className={`${CELDA} text-right font-extrabold`}>Precio</th>
                  <th scope="col" className={`${CELDA} font-extrabold`}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id} className="border-t border-borde">
                    <td className={CELDA}>
                      <Link to={`/insumos/${i.id}`} className="font-extrabold text-tinta no-underline hover:text-rosa-activo">
                        {i.nombre}
                      </Link>
                      {i.proveedor && <span className="block text-[13px] text-suave">{i.proveedor}</span>}
                    </td>
                    <td className={`${CELDA} text-right font-extrabold whitespace-nowrap`}>{`${cantidad(i.existencia)} ${i.unidad}`}</td>
                    <td className={`${CELDA} text-right whitespace-nowrap text-tinta-media`}>{i.precio_unitario !== null ? `${precio(i.precio_unitario)} por unidad` : "—"}</td>
                    <td className={CELDA}>
                      <Etiqueta estado={i.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Inventario>
  );
}
