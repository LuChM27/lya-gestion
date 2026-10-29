import { useState, type FormEvent } from "react";
import { ErrorApi } from "../api";
import { decimales, leerNumero } from "../formato";
import { NUMERO_INVALIDO, TIPOS_INSUMO, type Insumo } from "../inventario";
import { Boton, BotonSecundario, Campo, Casilla, MensajeError, Selector } from "./Formulario";

export type DatosInsumo = {
  nombre: string;
  tipo: string;
  unidad: string;
  unidad_compra: string | null;
  factor_compra: number | null;
  stock_minimo: number;
  proveedor: string | null;
  precio_unitario: number | null;
};

const texto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

export default function FormularioInsumo({
  inicial,
  alGuardar,
  alCancelar,
}: {
  inicial?: Insumo;
  alGuardar: (datos: DatosInsumo) => Promise<void>;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [tipo, setTipo] = useState(inicial?.tipo ?? "hilo");
  const [unidad, setUnidad] = useState(inicial?.unidad ?? "");
  const [porPaquete, setPorPaquete] = useState(Boolean(inicial?.unidad_compra));
  const [unidadCompra, setUnidadCompra] = useState(inicial?.unidad_compra ?? "");
  const [factor, setFactor] = useState(texto(inicial?.factor_compra));
  const [minimo, setMinimo] = useState(texto(inicial?.stock_minimo));
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? "");
  const precioInicial = texto(inicial?.precio_unitario);
  const [precio, setPrecio] = useState(precioInicial);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const limpiar = () => setError("");

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nombre.trim()) return setError("Escribe el nombre del insumo.");
    if (!unidad.trim()) return setError("Escribe la unidad, por ejemplo metros, gramos o unidades.");
    const stockMinimo = minimo.trim() ? leerNumero(minimo) : 0;
    const factorCompra = porPaquete && factor.trim() ? leerNumero(factor) : null;
    const precioUnitario = precio.trim() ? leerNumero(precio) : null;
    if (
      stockMinimo === null ||
      stockMinimo < 0 ||
      (porPaquete && factor.trim() && (factorCompra === null || factorCompra <= 0)) ||
      (precio.trim() && (precioUnitario === null || precioUnitario < 0))
    ) {
      return setError(NUMERO_INVALIDO);
    }
    if (precioUnitario !== null && decimales(precioUnitario) > 2) return setError("Usa máximo 2 decimales en los precios.");
    if (decimales(stockMinimo) > 3 || (factorCompra !== null && decimales(factorCompra) > 3)) {
      return setError("Usa máximo 3 decimales.");
    }
    setEnviando(true);
    try {
      await alGuardar({
        nombre: nombre.trim(),
        tipo,
        unidad: unidad.trim(),
        unidad_compra: porPaquete && unidadCompra.trim() ? unidadCompra.trim() : null,
        factor_compra: factorCompra,
        stock_minimo: stockMinimo,
        proveedor: proveedor.trim() || null,
        // Sin cambios no se reenvía: otra compra pudo cambiar el precio vigente mientras tanto.
        precio_unitario: precio === precioInicial ? null : precioUnitario,
      });
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  const nombreUnidad = unidad.trim() || "unidades";
  return (
    <form onSubmit={alEnviar} noValidate className="rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:p-[26px]">
      <Campo etiqueta="Nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); limpiar(); }} />
      <Selector etiqueta="Tipo" opciones={TIPOS_INSUMO} value={tipo} onChange={(e) => setTipo(e.target.value)} />
      <Campo etiqueta="Unidad" placeholder="metros, gramos, unidades…" maxLength={20} value={unidad} onChange={(e) => { setUnidad(e.target.value); limpiar(); }} />
      <Casilla etiqueta="Lo compro por paquete, cono o rollo" checked={porPaquete} onChange={(e) => setPorPaquete(e.target.checked)} />
      {porPaquete && (
        <>
          <Campo etiqueta="Unidad de compra" placeholder="cono, paquete, rollo…" maxLength={20} value={unidadCompra} onChange={(e) => { setUnidadCompra(e.target.value); limpiar(); }} />
          <Campo etiqueta={`Cantidad de ${nombreUnidad} que trae`} inputMode="decimal" value={factor} onChange={(e) => { setFactor(e.target.value); limpiar(); }} />
        </>
      )}
      <Campo etiqueta="Stock mínimo" inputMode="decimal" required={false} value={minimo} onChange={(e) => { setMinimo(e.target.value); limpiar(); }} />
      <Campo etiqueta="Proveedor (opcional)" required={false} value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
      <Campo etiqueta="Precio por unidad (opcional)" inputMode="decimal" required={false} value={precio} onChange={(e) => { setPrecio(e.target.value); limpiar(); }} />
      <MensajeError texto={error} />
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>Guardar insumo</Boton>
        <BotonSecundario onClick={alCancelar}>Cancelar</BotonSecundario>
      </div>
    </form>
  );
}
