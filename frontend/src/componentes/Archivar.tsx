import Confirmar from "./Confirmar";

/** Archivar con confirmación en la misma pantalla, sin diálogos del navegador. */
export default function Archivar({ boton, nombre, alArchivar }: { boton: string; nombre: string; alArchivar: () => Promise<void> }) {
  return <Confirmar boton={boton} pregunta={`¿Archivar ${nombre}? Sus ventas y movimientos se conservan.`} accion="Archivar" alConfirmar={alArchivar} />;
}
