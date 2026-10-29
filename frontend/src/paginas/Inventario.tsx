import { useEffect, useState, type ReactNode } from "react";
import { pedir } from "../api";
import { Encabezado, Pestanas } from "../componentes/ui";

// Encabezado y pestañas de docs/mockups/fuentes/inventario-mac.html, compartidos por Productos e Insumos.
// «En producción» se agrega cuando exista la producción.
type Resumen = { vitrina: { piezas: number }; por_revisar: { insumos: number } };

export default function Inventario({ acciones, filtros, children }: { acciones: ReactNode; filtros?: ReactNode; children: ReactNode }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    pedir<Resumen>("/api/inicio")
      .then(setResumen)
      .catch(() => setResumen(null)); // el subtítulo es opcional
  }, []);

  const insumos = resumen?.por_revisar.insumos ?? 0;
  return (
    <>
      <Encabezado
        titulo="Inventario"
        subtitulo={resumen && `${resumen.vitrina.piezas} ${resumen.vitrina.piezas === 1 ? "pieza" : "piezas"} en vitrina · ${insumos} ${insumos === 1 ? "insumo" : "insumos"} por revisar`}
        acciones={acciones}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Pestanas
          etiqueta="Tipo de inventario"
          pestanas={[
            { a: "/productos", texto: "Productos en vitrina" },
            { a: "/insumos", texto: "Insumos" },
          ]}
        />
        {filtros}
      </div>
      {children}
    </>
  );
}
