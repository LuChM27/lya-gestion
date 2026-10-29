export type EstadoStock = "ok" | "por_agotarse" | "bajo_minimo";

export default function Estado({ estado }: { estado: EstadoStock }) {
  if (estado === "ok") return null;
  const [texto, clases] =
    estado === "bajo_minimo"
      ? ["Bajo mínimo", "bg-peligro-fondo text-peligro"]
      : ["Por agotarse", "bg-alerta-fondo text-alerta"];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${clases}`}>{texto}</span>;
}
