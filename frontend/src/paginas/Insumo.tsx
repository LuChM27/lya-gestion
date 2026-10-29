import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { actualizar, borrar, enviar, ErrorApi, pedir } from "../api";
import AccionCantidad from "../componentes/AccionCantidad";
import Archivar from "../componentes/Archivar";
import { Etiqueta } from "../componentes/ui";
import { Boton, BotonSecundario, Campo, Selector } from "../componentes/Formulario";
import FormularioInsumo from "../componentes/FormularioInsumo";
import Historial from "../componentes/Historial";
import { cantidad, fecha, leerNumero, precio } from "../formato";
import { NUMERO_INVALIDO, TIPOS_INSUMO, type Insumo as TipoInsumo } from "../inventario";

type Accion = "entrada" | "merma" | "contar" | "movimientos" | "precios" | null;
type Precio = { precio_unitario: number; desde: string; origen: string };

function Entrada({ insumo, alGuardar, alCancelar }: { insumo: TipoInsumo; alGuardar: () => void; alCancelar: () => void }) {
  const [enCompra, setEnCompra] = useState(false);
  const [pagado, setPagado] = useState("");
  const unidadElegida = enCompra ? insumo.unidad_compra : null;

  return (
    <AccionCantidad
      etiqueta="Cantidad"
      alCancelar={alCancelar}
      alGuardar={async (n) => {
        const precioUnitario = pagado.trim() ? leerNumero(pagado) : null;
        if (pagado.trim() && (precioUnitario === null || precioUnitario < 0)) throw new Error(NUMERO_INVALIDO);
        await enviar(`/api/inventario/insumos/${insumo.id}/entradas`, {
          cantidad: n,
          en_unidad_compra: enCompra,
          precio_unitario: precioUnitario,
        });
        alGuardar();
      }}
    >
      {insumo.unidad_compra && (
        <Selector
          etiqueta="En"
          opciones={[
            ["base", insumo.unidad],
            ["compra", insumo.unidad_compra],
          ]}
          value={enCompra ? "compra" : "base"}
          onChange={(e) => setEnCompra(e.target.value === "compra")}
        />
      )}
      <Campo
        etiqueta={unidadElegida ? `Precio pagado por cada ${unidadElegida} (opcional)` : "Precio pagado por unidad (opcional)"}
        inputMode="decimal"
        required={false}
        value={pagado}
        onChange={(e) => setPagado(e.target.value)}
      />
    </AccionCantidad>
  );
}

function Precios({ ruta }: { ruta: string }) {
  const [precios, setPrecios] = useState<Precio[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    pedir<Precio[]>(ruta)
      .then(setPrecios)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  if (error) return <p role="alert" className="mt-2 text-sm font-semibold text-error">{error}</p>;
  if (!precios) return null;
  if (precios.length === 0) return <p className="mt-2 text-sm text-suave">Todavía no tiene precio.</p>;
  return (
    <ul className="mt-2 divide-y divide-borde text-sm">
      {precios.map((p, i) => (
        <li key={i} className="flex items-center justify-between gap-2 py-2">
          <span>
            <span className="block font-semibold">{p.origen === "compra" ? "Compra" : "Editado"}</span>
            <span className="text-suave">{fecha(p.desde)}</span>
          </span>
          <span className="font-bold">{precio(p.precio_unitario)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Insumo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [insumo, setInsumo] = useState<TipoInsumo | null>(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [accion, setAccion] = useState<Accion>(null);
  const ruta = `/api/inventario/insumos/${id}`;

  const cargar = useCallback(() => {
    pedir<TipoInsumo>(ruta)
      .then(setInsumo)
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, [ruta]);

  useEffect(cargar, [cargar]);

  if (error) return <p role="alert" className="font-semibold text-error">{error}</p>;
  if (!insumo) return null;
  const tipo = TIPOS_INSUMO.find(([valor]) => valor === insumo.tipo)?.[1] ?? insumo.tipo;
  const listo = () => {
    setAccion(null);
    cargar();
  };

  return (
    <>
      <Link to="/insumos" className="inline-flex h-11 items-center gap-2 self-start text-sm font-extrabold text-rosa-oscuro no-underline">
        Volver a insumos
      </Link>
      {editando ? (
        <FormularioInsumo
          inicial={insumo}
          alCancelar={() => setEditando(false)}
          alGuardar={async (datos) => {
            setInsumo(await actualizar<TipoInsumo>(ruta, datos));
            setEditando(false);
          }}
        />
      ) : (
        <section className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-titulo text-[30px] leading-[1.15] font-semibold tracking-[-0.01em] md:text-[40px] md:leading-[1.1]">{insumo.nombre}</h1>
            <p className="text-suave">
              {tipo}
              {insumo.proveedor && ` · ${insumo.proveedor}`}
              {insumo.unidad_compra && insumo.factor_compra !== null && ` · 1 ${insumo.unidad_compra} = ${cantidad(insumo.factor_compra)} ${insumo.unidad}`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-bold">{`${cantidad(insumo.existencia)} ${insumo.unidad}`}</span>
              <Etiqueta estado={insumo.estado} />
              <span className="text-sm text-suave">{`mínimo ${cantidad(insumo.stock_minimo)}`}</span>
            </p>
            {insumo.precio_unitario !== null && <p className="text-suave">{`${precio(insumo.precio_unitario)} por unidad`}</p>}
            {!insumo.activo && <p className="mt-1 font-semibold text-suave">Archivado</p>}
          </div>
          {insumo.activo && <BotonSecundario onClick={() => setEditando(true)}>Editar insumo</BotonSecundario>}
        </section>
      )}
      {insumo.activo && accion === null && (
        <div className="flex flex-wrap gap-2">
          <BotonSecundario onClick={() => setAccion("entrada")}>Registrar entrada</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("merma")}>Registrar merma</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("contar")}>Contar</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("movimientos")}>Ver movimientos</BotonSecundario>
          <BotonSecundario onClick={() => setAccion("precios")}>Ver precios</BotonSecundario>
        </div>
      )}
      <div>
        {accion === "entrada" && <Entrada insumo={insumo} alGuardar={listo} alCancelar={() => setAccion(null)} />}
        {accion === "merma" && (
          <AccionCantidad
            etiqueta="Cantidad"
            alCancelar={() => setAccion(null)}
            alGuardar={async (n) => {
              await enviar(`${ruta}/movimientos`, { tipo: "merma", cantidad: n });
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
        {(accion === "movimientos" || accion === "precios") && (
          <>
            {accion === "movimientos" ? <Historial ruta={`${ruta}/movimientos`} unidad={insumo.unidad} /> : <Precios ruta={`${ruta}/precios`} />}
            <BotonSecundario className="mt-2" onClick={() => setAccion(null)}>Cerrar</BotonSecundario>
          </>
        )}
      </div>
      {!insumo.activo && (
        <Boton
          onClick={async () => {
            try {
              setInsumo(await enviar<TipoInsumo>(`${ruta}/restaurar`, {}));
            } catch (err) {
              setError(err instanceof ErrorApi ? err.mensaje : String(err));
            }
          }}
        >
          Volver a usar
        </Boton>
      )}
      {insumo.activo && (
        <Archivar
          boton="Archivar insumo"
          nombre={insumo.nombre}
          alArchivar={async () => {
            await borrar(ruta);
            navegar("/insumos", { replace: true });
          }}
        />
      )}
    </>
  );
}
