import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { actualizar, borrar, enviar, ErrorApi, pedir } from "../api";
import AccionCantidad from "../componentes/AccionCantidad";
import Archivar from "../componentes/Archivar";
import Estado from "../componentes/Estado";
import { Boton, BotonSecundario, Campo, Casilla, MensajeError } from "../componentes/Formulario";
import FormularioModelo from "../componentes/FormularioModelo";
import Historial from "../componentes/Historial";
import SubirFoto from "../componentes/SubirFoto";
import { cantidad, leerNumero, pesos, unidades } from "../formato";
import { CATEGORIAS, miniatura, NUMERO_INVALIDO, type ModeloDetalle, type Variante } from "../inventario";

type Accion = "vitrina" | "merma" | "contar" | "historial" | "editar" | null;

function TarjetaVariante({ variante, alCambiar }: { variante: Variante; alCambiar: () => void }) {
  const [accion, setAccion] = useState<Accion>(null);
  const ruta = `/api/inventario/variantes/${variante.id}`;
  const listo = () => {
    setAccion(null);
    alCambiar();
  };

  return (
    <li className={`rounded-2xl border border-borde bg-superficie p-4 ${variante.activo ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        {variante.foto && <img src={miniatura(variante.foto)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {variante.color}
            {variante.pieza_unica && <span className="ml-2 text-sm font-semibold text-suave">Pieza única</span>}
            {!variante.activo && <span className="ml-2 text-sm font-semibold text-suave">Archivada</span>}
          </p>
          <p className="text-sm text-suave">
            {variante.sku} · mínimo {cantidad(variante.stock_minimo)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold">{unidades(variante.existencia)}</p>
          <Estado estado={variante.estado} />
        </div>
      </div>
      {!variante.activo && (
        <BotonSecundario
          className="mt-3"
          onClick={async () => {
            await enviar(`${ruta}/restaurar`, {});
            alCambiar();
          }}
        >
          Volver a usar
        </BotonSecundario>
      )}
      {variante.activo && accion === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <BotonSecundario onClick={() => setAccion("vitrina")}>Sumar a vitrina</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("merma")}>Registrar merma</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("contar")}>Contar</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("historial")}>Ver movimientos</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("editar")}>Editar variante</BotonSecundario>
          <Archivar
            boton="Archivar variante"
            nombre={variante.color}
            alArchivar={async () => {
              await borrar(ruta);
              alCambiar();
            }}
          />
        </div>
      )}
      {accion === "editar" && (
        <div className="mt-3">
          <FormularioVariante inicial={variante} ruta={ruta} metodo="PUT" alGuardar={listo} alCancelar={() => setAccion(null)} />
        </div>
      )}
      {(accion === "vitrina" || accion === "merma") && (
        <AccionCantidad
          etiqueta="Cantidad"
          alCancelar={() => setAccion(null)}
          alGuardar={async (n) => {
            await enviar(`${ruta}/movimientos`, { tipo: accion === "vitrina" ? "ingreso_vitrina" : "merma", cantidad: n });
            listo();
          }}
        />
      )}
      {accion === "contar" && (
        <AccionCantidad
          etiqueta="Cantidad contada"
          permitirCero
          alCancelar={() => setAccion(null)}
          alGuardar={async (n) => {
            await enviar(`${ruta}/conteo`, { cantidad_contada: n });
            listo();
          }}
        />
      )}
      {accion === "historial" && (
        <>
          <Historial ruta={`${ruta}/movimientos`} />
          <BotonSecundario className="mt-2" onClick={() => setAccion(null)}>Cerrar movimientos</BotonSecundario>
        </>
      )}
    </li>
  );
}

function FormularioVariante({
  inicial,
  ruta,
  metodo,
  alGuardar,
  alCancelar,
}: {
  inicial?: Variante;
  ruta: string;
  metodo: "POST" | "PUT";
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [color, setColor] = useState(inicial?.color ?? "");
  const [sku, setSku] = useState(inicial?.sku ?? "");
  const [minimo, setMinimo] = useState(inicial ? String(inicial.stock_minimo).replace(".", ",") : "");
  const [piezaUnica, setPiezaUnica] = useState(inicial?.pieza_unica ?? false);
  const [foto, setFoto] = useState<string | null>(inicial?.foto ?? null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!color.trim()) return setError("Escribe el color o la combinación de colores.");
    const stockMinimo = minimo.trim() ? leerNumero(minimo) : 0;
    if (stockMinimo === null || stockMinimo < 0) return setError(NUMERO_INVALIDO);
    setEnviando(true);
    try {
      const datos = {
        color: color.trim(),
        sku: sku.trim() || null,
        stock_minimo: piezaUnica ? 0 : stockMinimo,
        pieza_unica: piezaUnica,
        foto,
      };
      await (metodo === "POST" ? enviar(ruta, datos) : actualizar(ruta, datos));
      alGuardar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="mb-4 rounded-2xl border border-borde bg-superficie p-4">
      <Campo etiqueta="Color" value={color} onChange={(e) => { setColor(e.target.value); setError(""); }} />
      <Campo etiqueta="Código (opcional)" required={false} maxLength={30} value={sku} onChange={(e) => setSku(e.target.value)} />
      <Casilla etiqueta="Pieza única" checked={piezaUnica} onChange={(e) => setPiezaUnica(e.target.checked)} />
      {!piezaUnica && (
        <Campo etiqueta="Stock mínimo" inputMode="decimal" required={false} value={minimo} onChange={(e) => { setMinimo(e.target.value); setError(""); }} />
      )}
      <SubirFoto foto={foto} alSubir={setFoto} />
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>Guardar variante</Boton>
        <BotonSecundario onClick={alCancelar}>Cancelar</BotonSecundario>
      </div>
    </form>
  );
}

export default function Modelo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [modelo, setModelo] = useState<ModeloDetalle | null>(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const ruta = `/api/inventario/modelos/${id}`;

  const cargar = useCallback(() => {
    pedir<ModeloDetalle>(ruta)
      .then(setModelo)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  useEffect(cargar, [cargar]);

  if (error) return <p role="alert" className="font-semibold text-error">{error}</p>;
  if (!modelo) return null;
  const categoria = CATEGORIAS.find(([valor]) => valor === modelo.categoria)?.[1] ?? modelo.categoria;

  return (
    <>
      <Link to="/productos" className="mb-3 inline-flex h-11 items-center font-semibold text-rosa-oscuro underline">
        Volver a productos
      </Link>
      {editando ? (
        <FormularioModelo
          inicial={modelo}
          alCancelar={() => setEditando(false)}
          alGuardar={async (datos) => {
            setModelo(await actualizar<ModeloDetalle>(ruta, datos));
            setEditando(false);
          }}
        />
      ) : (
        <section className="mb-6 flex flex-wrap items-start gap-4">
          {modelo.foto && <img src={miniatura(modelo.foto)} alt="" className="h-28 w-28 rounded-2xl object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{modelo.nombre}</h1>
            <p className="text-suave">
              {categoria} · {pesos(modelo.precio_venta)} · {cantidad(modelo.horas_tejido)} h de tejido
            </p>
            <p className="mt-1 flex items-center gap-2">
              {unidades(modelo.unidades)} <Estado estado={modelo.estado} />
            </p>
            {!modelo.activo && <p className="mt-1 font-semibold text-suave">Archivado</p>}
          </div>
          {modelo.activo && <BotonSecundario onClick={() => setEditando(true)}>Editar modelo</BotonSecundario>}
        </section>
      )}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Variantes</h2>
        {modelo.activo && !agregando && <BotonSecundario onClick={() => setAgregando(true)}>Agregar variante</BotonSecundario>}
      </div>
      {agregando && (
        <FormularioVariante
          ruta={`${ruta}/variantes`}
          metodo="POST"
          alCancelar={() => setAgregando(false)}
          alGuardar={() => {
            setAgregando(false);
            cargar();
          }}
        />
      )}
      {modelo.variantes.length === 0 && !agregando && (
        <p className="mb-4 text-suave">Agrega un color o una pieza única para llevar sus unidades.</p>
      )}
      <ul className="mb-8 grid gap-3">
        {modelo.variantes.map((v) => (
          <TarjetaVariante key={v.id} variante={v} alCambiar={cargar} />
        ))}
      </ul>
      {!modelo.activo && (
        <Boton
          onClick={async () => {
            try {
              setModelo(await enviar<ModeloDetalle>(`${ruta}/restaurar`, {}));
            } catch (err) {
              setError(err instanceof ErrorApi ? err.mensaje : String(err));
            }
          }}
        >
          Volver a usar
        </Boton>
      )}
      {modelo.activo && (
        <Archivar
          boton="Archivar modelo"
          nombre={modelo.nombre}
          alArchivar={async () => {
            await borrar(ruta);
            navegar("/productos", { replace: true });
          }}
        />
      )}
    </>
  );
}
