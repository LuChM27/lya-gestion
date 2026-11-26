import { useEffect, useState, type FormEvent } from "react";
import { actualizar, borrar, enviar, ErrorApi, pedir } from "../api";
import { leerPesos, MONTO_INVALIDO, type Categoria, type GastoFijo } from "../dinero";
import { pesos } from "../formato";
import type { Cuenta } from "../ventas";
import Archivar from "./Archivar";
import { Boton, BotonSecundario, Campo, MensajeError } from "./Formulario";
import { Pastillas } from "./ui";

/** Un gasto que se repite cada mes. Solo es un recordatorio: nunca se descuenta solo. */
export default function FormularioGastoFijo({ inicial, alGuardar, alCancelar }: { inicial?: GastoFijo; alGuardar: () => void; alCancelar: () => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [monto, setMonto] = useState(inicial ? pesos(inicial.monto) : "");
  const [categoria, setCategoria] = useState(inicial ? String(inicial.categoria_id) : "");
  const [cuenta, setCuenta] = useState(inicial?.cuenta_id ? String(inicial.cuenta_id) : "");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([pedir<Cuenta[]>("/api/cuentas"), pedir<Categoria[]>("/api/categorias?tipo=gasto")])
      .then(([c, cats]) => (setCuentas(c), setCategorias(cats)))
      .catch((err) => setError(err instanceof ErrorApi ? err.mensaje : String(err)));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nombre.trim()) return setError("Escribe qué pagas, por ejemplo Internet.");
    const valor = leerPesos(monto);
    if (valor === null || valor < 0) return setError(MONTO_INVALIDO);
    if (!categoria) return setError("Elige una categoría.");
    const cuerpo = { nombre: nombre.trim(), monto: valor, categoria_id: Number(categoria), cuenta_id: cuenta ? Number(cuenta) : null };
    setEnviando(true);
    try {
      if (inicial) await actualizar(`/api/gastos-fijos/${inicial.id}`, cuerpo);
      else await enviar("/api/gastos-fijos", cuerpo);
      alGuardar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate aria-label={inicial ? `Editar ${inicial.nombre}` : "Nuevo gasto fijo"} className="flex flex-col gap-3 rounded-[22px] border border-borde bg-fondo p-4">
      <div className="grid gap-x-4 md:grid-cols-2">
        <Campo etiqueta="¿Qué pagas?" value={nombre} onChange={(e) => (setNombre(e.target.value), setError(""))} maxLength={80} autoComplete="off" />
        <Campo etiqueta="Monto aproximado" value={monto} onChange={(e) => (setMonto(e.target.value), setError(""))} inputMode="numeric" placeholder="$ 0" />
      </div>
      <span className="text-sm font-extrabold">Categoría</span>
      <Pastillas etiqueta="Categoría" opciones={categorias.map((c) => [String(c.id), c.nombre] as const)} valor={categoria} alElegir={setCategoria} alto="chico" />
      <span className="text-sm font-extrabold">¿De dónde sale casi siempre?</span>
      <Pastillas etiqueta="Cuenta" opciones={[["", "Cualquiera"] as const, ...cuentas.map((c) => [String(c.id), c.nombre] as const)]} valor={cuenta} alElegir={setCuenta} alto="chico" />
      <MensajeError texto={error} />
      <div className="flex flex-wrap gap-2.5">
        <Boton type="submit" disabled={enviando} className="h-12 w-auto px-6 text-[15px]">
          Guardar gasto fijo
        </Boton>
        <BotonSecundario onClick={alCancelar} className="h-12">
          Cancelar
        </BotonSecundario>
        {inicial && (
          <Archivar
            boton="Archivar"
            nombre={inicial.nombre}
            alArchivar={async () => {
              await borrar(`/api/gastos-fijos/${inicial.id}`);
              alGuardar();
            }}
          />
        )}
      </div>
    </form>
  );
}
