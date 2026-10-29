import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import FormularioModelo from "../componentes/FormularioModelo";
import { IconoSumar, IconoVentas } from "../componentes/iconos";
import { BotonPastilla, BotonPrincipal, Buscador, Etiqueta, FotoProducto, Pastillas, Vacio } from "../componentes/ui";
import { pesos } from "../formato";
import { CATEGORIAS, type ModeloDetalle, type ModeloResumen } from "../inventario";
import Inventario from "./Inventario";

// Pestaña «Productos en vitrina» de docs/mockups/fuentes/inventario-mac.html.
const FILTROS = [["", "Todos"], ["crochet", "Crochet"], ["murano", "Murano"], ["cristal", "Cristal"], ["otro", "Otros"]] as const;
const nombreCategoria = (c: string) => FILTROS.find(([v]) => v === c)?.[1] ?? CATEGORIAS.find(([v]) => v === c)?.[1] ?? c;

export default function Productos() {
  const navegar = useNavigate();
  const [modelos, setModelos] = useState<ModeloResumen[] | null>(null);
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("");
  const [creando, setCreando] = useState(false);
  const [archivados, setArchivados] = useState(false);
  const [error, setError] = useState("");
  const ultima = useRef(0);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (buscar.trim()) parametros.set("buscar", buscar.trim());
    if (categoria) parametros.set("categoria", categoria);
    if (archivados) parametros.set("archivados", "true");
    const consulta = parametros.toString();
    const numero = ++ultima.current;
    pedir<ModeloResumen[]>(`/api/inventario/modelos${consulta ? `?${consulta}` : ""}`)
      .then((r) => {
        if (numero !== ultima.current) return; // llegó tarde: ya se escribió otra búsqueda
        setModelos(r);
        setError("");
      })
      .catch((err) => {
        if (numero === ultima.current) setError(err instanceof ErrorApi ? err.mensaje : String(err));
      });
  }, [buscar, categoria, archivados]);

  const filtrando = buscar.trim() !== "" || categoria !== "" || archivados;
  const hayLista = modelos?.length !== 0 || filtrando;

  return (
    <Inventario
      acciones={
        <>
          <div className="hidden md:block">
            <BotonPastilla a="/insumos" icono={IconoVentas}>
              Registrar compra de insumos
            </BotonPastilla>
          </div>
          {!creando && (
            <BotonPrincipal icono={IconoSumar} onClick={() => setCreando(true)}>
              Nuevo modelo
            </BotonPrincipal>
          )}
        </>
      }
      filtros={hayLista && <Pastillas etiqueta="Categoría" opciones={FILTROS} valor={categoria} alElegir={setCategoria} alto="chico" />}
    >
      {creando && (
        <FormularioModelo
          alCancelar={() => setCreando(false)}
          alGuardar={async (datos) => {
            const m = await enviar<ModeloDetalle>("/api/inventario/modelos", datos);
            navegar(`/productos/${m.id}`);
          }}
        />
      )}
      {!creando && (
        <div className="flex flex-wrap items-center gap-3">
          {hayLista && <Buscador valor={buscar} alCambiar={setBuscar} placeholder="Buscar modelo, color o código" />}
          <BotonPastilla onClick={() => setArchivados((a) => !a)} aria-pressed={archivados} className="h-10 px-4 text-sm">
            {archivados ? "Ver activos" : "Ver archivados"}
          </BotonPastilla>
        </div>
      )}
      {error && <p role="alert" className="font-bold text-error">{error}</p>}
      {modelos?.length === 0 && !filtrando && !creando && (
        <Vacio texto="Todavía no hay productos.">
          <BotonPrincipal icono={IconoSumar} onClick={() => setCreando(true)}>
            Crear el primer modelo
          </BotonPrincipal>
        </Vacio>
      )}
      {modelos?.length === 0 && filtrando && (
        <Vacio texto={archivados && !buscar.trim() ? "No hay productos archivados." : buscar.trim() ? `No hay productos que coincidan con “${buscar.trim()}”.` : "No hay productos en esta categoría."}>
          <BotonPastilla onClick={() => { setBuscar(""); setCategoria(""); setArchivados(false); }}>
            {buscar.trim() ? "Borrar búsqueda" : "Ver todos"}
          </BotonPastilla>
        </Vacio>
      )}
      <section aria-label="Productos" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-4">
        {modelos?.map((m) => (
          <Link
            key={m.id}
            to={`/productos/${m.id}`}
            className="flex flex-col overflow-hidden rounded-[20px] border border-borde bg-superficie text-tinta no-underline shadow-tarjeta hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa md:rounded-3xl"
          >
            <div className="relative">
              <FotoProducto foto={m.foto} categoria={m.categoria} nombre={m.nombre} className="h-[110px] md:h-[150px]" />
              <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3">
                <Etiqueta estado={m.estado} />
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pt-3.5 pb-4 md:px-[18px] md:pt-4 md:pb-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-extrabold tracking-[0.08em] text-suave uppercase">{nombreCategoria(m.categoria)}</span>
                <h3 className="line-clamp-2 text-[15px] leading-[1.3] font-extrabold md:text-base">{m.nombre}</h3>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 text-[13px] font-bold text-suave">
                <span>{`${m.variantes} ${m.variantes === 1 ? "color" : "colores"}`}</span>
                <span>{`${m.unidades} en vitrina`}</span>
              </div>
              <span className="text-lg font-extrabold">{pesos(m.precio_venta)}</span>
            </div>
          </Link>
        ))}
      </section>
    </Inventario>
  );
}
