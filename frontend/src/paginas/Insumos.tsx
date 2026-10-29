import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { enviar, ErrorApi, pedir } from "../api";
import { Etiqueta } from "../componentes/ui";
import { Boton, BotonSecundario, Campo } from "../componentes/Formulario";
import FormularioInsumo from "../componentes/FormularioInsumo";
import { cantidad, precio } from "../formato";
import { TIPOS_INSUMO, type Insumo } from "../inventario";

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

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Insumos</h1>
        {!creando && (
          <div>
            <Boton onClick={() => setCreando(true)}>Agregar insumo</Boton>
          </div>
        )}
      </div>
      {creando && (
        <FormularioInsumo
          alCancelar={() => setCreando(false)}
          alGuardar={async (datos) => {
            const i = await enviar<Insumo>("/api/inventario/insumos", datos);
            navegar(`/insumos/${i.id}`);
          }}
        />
      )}
      {(insumos?.length !== 0 || filtrando) && (
        <>
          <Campo etiqueta="Buscar" type="search" required={false} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div role="group" aria-label="Tipo" className="mb-4 flex flex-wrap gap-2">
            {[["", "Todos"] as const, ...TIPOS_INSUMO].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={tipo === valor}
                onClick={() => setTipo(valor)}
                className={`h-11 rounded-full border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-rosa ${
                  tipo === valor ? "border-rosa bg-rosa text-white" : "border-borde bg-superficie"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mb-4">
        <BotonSecundario onClick={() => setArchivados((a) => !a)} aria-pressed={archivados}>
          {archivados ? "Ver activos" : "Ver archivados"}
        </BotonSecundario>
      </div>
      {error && <p role="alert" className="mb-4 font-semibold text-error">{error}</p>}
      {insumos?.length === 0 && !filtrando && !creando && (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <p className="mb-4 text-suave">Todavía no hay insumos.</p>
          <div className="mx-auto max-w-xs">
            <Boton onClick={() => setCreando(true)}>Agregar el primer insumo</Boton>
          </div>
        </div>
      )}
      {insumos?.length === 0 && filtrando && (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <p className="mb-4 text-suave">
            {archivados && !buscar.trim() ? "No hay insumos archivados." : buscar.trim() ? `No hay insumos que coincidan con “${buscar.trim()}”.` : "No hay insumos de este tipo."}
          </p>
          <BotonSecundario onClick={() => { setBuscar(""); setTipo(""); setArchivados(false); }}>
            {buscar.trim() ? "Borrar búsqueda" : "Ver todos"}
          </BotonSecundario>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {insumos?.map((i) => (
          <li key={i.id}>
            <Link
              to={`/insumos/${i.id}`}
              className="block rounded-2xl border border-borde bg-superficie p-3 hover:border-rosa focus-visible:outline-2 focus-visible:outline-rosa"
            >
              <span className="block truncate font-bold">{i.nombre}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span>{`${cantidad(i.existencia)} ${i.unidad}`}</span>
                <Etiqueta estado={i.estado} />
              </span>
              {i.precio_unitario !== null && (
                <span className="block text-sm text-suave">{`${precio(i.precio_unitario)} por unidad`}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
