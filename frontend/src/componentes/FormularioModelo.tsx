import { useState, type FormEvent } from "react";
import { ErrorApi } from "../api";
import { leerNumero } from "../formato";
import { CATEGORIAS, NUMERO_INVALIDO, type ModeloDetalle } from "../inventario";
import { Boton, BotonSecundario, Campo, MensajeError, Selector } from "./Formulario";
import SubirFoto from "./SubirFoto";

export type DatosModelo = { nombre: string; categoria: string; precio_venta: number; horas_tejido: number; foto: string | null };

export default function FormularioModelo({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: ModeloDetalle;
  alGuardar: (datos: DatosModelo) => Promise<void>;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [categoria, setCategoria] = useState(inicial?.categoria ?? "crochet");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio_venta) : "");
  const [horas, setHoras] = useState(inicial ? String(inicial.horas_tejido).replace(".", ",") : "");
  const [foto, setFoto] = useState<string | null>(inicial?.foto ?? null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nombre.trim()) return setError("Escribe el nombre del modelo.");
    const precioVenta = leerNumero(precio);
    const horasTejido = horas.trim() ? leerNumero(horas) : 0;
    if (precioVenta === null || horasTejido === null || precioVenta < 0 || horasTejido < 0) return setError(NUMERO_INVALIDO);
    setEnviando(true);
    try {
      await alGuardar({ nombre: nombre.trim(), categoria, precio_venta: Math.round(precioVenta), horas_tejido: horasTejido, foto });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:p-[26px]">
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(""); }} />
      <Selector etiqueta="Categoría" opciones={CATEGORIAS} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
      <Campo etiqueta="Precio de venta" inputMode="numeric" value={precio} onChange={(e) => { setPrecio(e.target.value); setError(""); }} />
      <Campo etiqueta="Horas de tejido" inputMode="decimal" required={false} value={horas} onChange={(e) => { setHoras(e.target.value); setError(""); }} />
      <SubirFoto foto={foto} alSubir={setFoto} />
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>Guardar modelo</Boton>
        <BotonSecundario onClick={alCancelar}>Cancelar</BotonSecundario>
      </div>
    </form>
  );
}
