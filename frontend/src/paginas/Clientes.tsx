import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { borrar, enviar, ErrorApi, pedir } from "../api";
import type { ClienteFicha, ClienteResumen } from "../clientes";
import FichaCliente, { Avatar } from "../componentes/FichaCliente";
import FormularioCliente from "../componentes/FormularioCliente";
import { IconoBuscar, IconoSumar, IconoVolver } from "../componentes/iconos";
import { BotonPrincipal, Encabezado, Vacio } from "../componentes/ui";
import { pesos, telefono } from "../formato";

// Lista y ficha lado a lado en la Mac, por separado en el celular: docs/mockups/fuentes/clientes-mac.html.
const TARJETA = "flex min-w-0 flex-col gap-3 rounded-[28px] border border-borde bg-superficie shadow-tarjeta";

export default function Clientes() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [buscar, setBuscar] = useState("");
  const [archivados, setArchivados] = useState(false);
  const [lista, setLista] = useState<ClienteResumen[] | null>(null);
  const [cargada, setFicha] = useState<ClienteFicha | null>(null);
  const [modo, setModo] = useState<"ver" | "crear" | "editar">("ver");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    let vigente = true;
    const params = new URLSearchParams();
    if (buscar.trim()) params.set("buscar", buscar.trim());
    if (archivados) params.set("archivados", "true");
    const consulta = params.toString();
    pedir<ClienteResumen[]>(`/api/clientes${consulta ? `?${consulta}` : ""}`)
      .then((l) => vigente && setLista(l))
      .catch((err) => vigente && setError(err instanceof ErrorApi ? err.mensaje : String(err)));
    return () => {
      vigente = false;
    };
  }, [buscar, archivados, version]);

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    pedir<ClienteFicha>(`/api/clientes/${id}`)
      .then((f) => vigente && setFicha(f))
      .catch((err) => vigente && setError(err instanceof ErrorApi ? err.mensaje : String(err)));
    return () => {
      vigente = false;
    };
  }, [id]);

  // La ficha cargada solo se muestra si es la de la dirección actual.
  const ficha = cargada && String(cargada.id) === id ? cargada : null;

  function guardada(c: ClienteFicha) {
    setModo("ver");
    setFicha(c);
    recargar();
    if (String(c.id) !== id) navegar(`/clientes/${c.id}`);
  }

  async function archivar() {
    if (!ficha) return;
    await borrar(`/api/clientes/${ficha.id}`);
    recargar();
    navegar("/clientes");
  }

  async function recuperar() {
    if (!ficha) return;
    try {
      setFicha(await enviar<ClienteFicha>(`/api/clientes/${ficha.id}/restaurar`, {}));
      recargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  const nueva = () => setModo("crear");
  const detalle = Boolean(id) || modo === "crear";
  const filtrando = buscar.trim() !== "" || archivados;

  let derecha;
  if (modo === "crear") {
    derecha = (
      <section aria-label="Nueva clienta" className={`${TARJETA} p-5 md:px-[26px] md:py-6`}>
        <h2 className="font-titulo text-[26px] font-semibold">Nueva clienta</h2>
        <FormularioCliente alCancelar={() => setModo("ver")} alGuardar={guardada} />
      </section>
    );
  } else if (ficha && modo === "editar") {
    derecha = (
      <section aria-label="Editar clienta" className={`${TARJETA} p-5 md:px-[26px] md:py-6`}>
        <h2 className="font-titulo text-[26px] font-semibold">Editar clienta</h2>
        <FormularioCliente inicial={ficha} alCancelar={() => setModo("ver")} alGuardar={guardada} />
      </section>
    );
  } else if (ficha) {
    derecha = <FichaCliente ficha={ficha} alEditar={() => setModo("editar")} alArchivar={archivar} alRecuperar={recuperar} />;
  } else if (!id) {
    derecha = (
      <div className="hidden md:block">
        <Vacio texto="Elige una clienta para ver su ficha." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={detalle ? "hidden md:block" : ""}>
        <Encabezado
          fecha
          titulo="Clientes"
          subtitulo={lista && !filtrando ? (lista.length === 1 ? "1 clienta" : `${lista.length} clientas`) : undefined}
          acciones={
            <BotonPrincipal icono={IconoSumar} onClick={nueva}>
              Nueva clienta
            </BotonPrincipal>
          }
        />
      </div>

      {detalle && (
        <Link
          to="/clientes"
          onClick={() => setModo("ver")}
          className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline md:hidden"
        >
          <IconoVolver tamano={18} />
          Volver a clientes
        </Link>
      )}

      {error && (
        <p role="alert" className="font-bold text-error">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 md:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <section aria-label="Lista de clientas" className={`${TARJETA} p-[18px] ${detalle ? "hidden md:flex" : ""}`}>
          {lista?.length === 0 && !filtrando ? (
            <Vacio texto="Todavía no tienes clientas.">
              <BotonPrincipal icono={IconoSumar} onClick={nueva}>
                Nueva clienta
              </BotonPrincipal>
            </Vacio>
          ) : (
            <>
              <label className="flex h-[52px] items-center gap-2.5 rounded-2xl border-[1.5px] border-borde-campo bg-superficie px-[18px] text-suave focus-within:border-rosa">
                <IconoBuscar tamano={18} />
                <span className="sr-only">Buscar clienta</span>
                <input
                  type="search"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Buscar por nombre, WhatsApp o Instagram"
                  className="min-w-0 flex-1 border-0 bg-transparent text-base text-tinta outline-none"
                />
              </label>
              {lista?.length === 0 ? (
                <p className="px-3.5 py-3 text-sm text-suave">{archivados && !buscar.trim() ? "No tienes clientas archivadas." : `Ninguna clienta coincide con «${buscar.trim()}».`}</p>
              ) : (
                <ul aria-label="Clientas" className="flex flex-col gap-1">
                  {lista?.map((c) => {
                    const activa = String(c.id) === id;
                    return (
                      <li key={c.id}>
                        <Link
                          to={`/clientes/${c.id}`}
                          onClick={() => setModo("ver")}
                          aria-current={activa ? "true" : undefined}
                          className={`flex items-center gap-3 rounded-[18px] px-3.5 py-3 text-tinta no-underline focus-visible:outline-2 focus-visible:outline-rosa ${activa ? "bg-rosa-claro" : "bg-superficie hover:bg-fondo"}`}
                        >
                          <Avatar nombre={c.nombre} />
                          <span className="flex min-w-0 flex-1 flex-col gap-px">
                            <span className="truncate text-[15px] font-extrabold">{c.nombre}</span>
                            <span className="text-[13px] text-suave">{telefono(c.whatsapp)}</span>
                          </span>
                          <span className="shrink-0 text-sm font-extrabold whitespace-nowrap">{pesos(c.total_comprado)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setArchivados((v) => !v)}
                className="min-h-11 self-start px-3.5 text-sm font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa"
              >
                {archivados ? "Ver clientas activas" : "Ver archivadas"}
              </button>
            </>
          )}
        </section>
        {derecha}
      </div>
    </div>
  );
}
