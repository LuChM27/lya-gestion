import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import Estado from "../componentes/Estado";
import { Boton, BotonSecundario, Campo } from "../componentes/Formulario";
import FormularioModelo from "../componentes/FormularioModelo";
import { pesos, unidades } from "../formato";
import { CATEGORIAS, miniatura, type ModeloDetalle, type ModeloResumen } from "../inventario";

export default function Productos() {
  const navegar = useNavigate();
  const [modelos, setModelos] = useState<ModeloResumen[] | null>(null);
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const ultima = useRef(0);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (buscar.trim()) parametros.set("buscar", buscar.trim());
    if (categoria) parametros.set("categoria", categoria);
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
  }, [buscar, categoria]);

  const filtrando = buscar.trim() !== "" || categoria !== "";

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Productos</h1>
        {!creando && (
          <div>
            <Boton onClick={() => setCreando(true)}>Agregar modelo</Boton>
          </div>
        )}
      </div>
      {creando && (
        <FormularioModelo
          alCancelar={() => setCreando(false)}
          alGuardar={async (datos) => {
            const m = await enviar<ModeloDetalle>("/api/inventario/modelos", datos);
            navegar(`/productos/${m.id}`);
          }}
        />
      )}
      {(modelos?.length !== 0 || filtrando) && (
        <>
          <Campo etiqueta="Buscar" type="search" required={false} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div role="group" aria-label="Categoría" className="mb-4 flex flex-wrap gap-2">
            {[["", "Todas"] as const, ...CATEGORIAS].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={categoria === valor}
                onClick={() => setCategoria(valor)}
                className={`h-11 rounded-full border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-rosa ${
                  categoria === valor ? "border-rosa bg-rosa text-white" : "border-borde bg-superficie"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert" className="mb-4 font-semibold text-error">{error}</p>}
      {modelos?.length === 0 && !filtrando && !creando && (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <p className="mb-4 text-suave">Todavía no hay productos.</p>
          <div className="mx-auto max-w-xs">
            <Boton onClick={() => setCreando(true)}>Agregar el primer modelo</Boton>
          </div>
        </div>
      )}
      {modelos?.length === 0 && filtrando && (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <p className="mb-4 text-suave">
            {buscar.trim() ? `No hay productos que coincidan con “${buscar.trim()}”.` : "No hay productos en esta categoría."}
          </p>
          <BotonSecundario onClick={() => { setBuscar(""); setCategoria(""); }}>
            {buscar.trim() ? "Borrar búsqueda" : "Ver todas"}
          </BotonSecundario>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {modelos?.map((m) => (
          <li key={m.id}>
            <Link
              to={`/productos/${m.id}`}
              className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
            >
              {m.foto ? (
                <img src={miniatura(m.foto)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-rosa-palo text-2xl font-bold text-rosa-oscuro">
                  {m.nombre.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{m.nombre}</span>
                <span className="block text-sm text-suave">{pesos(m.precio_venta)}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{unidades(m.unidades)}</span>
                  <Estado estado={m.estado} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
