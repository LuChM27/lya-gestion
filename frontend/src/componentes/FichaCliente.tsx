import { Link } from "react-router-dom";
import { iniciales, type ClienteFicha } from "../clientes";
import { fecha, pesos, telefono } from "../formato";
import { nombreCanal } from "../ventas";
import Archivar from "./Archivar";
import { BotonSecundario } from "./Formulario";
import { IconoEditar, IconoWhatsapp } from "./iconos";

// Ficha de docs/mockups/fuentes/clientes-mac.html.
const ESTADOS: Record<string, [string, string]> = {
  entregado: ["Entregada", "bg-ok-fondo text-ok"],
  cancelado: ["Anulada", "bg-peligro-fondo text-peligro"],
};

export function Avatar({ nombre, grande = false, chico = false }: { nombre: string; grande?: boolean; chico?: boolean }) {
  const tamano = grande ? "h-16 w-16 text-[22px]" : chico ? "h-10 w-10 text-[15px]" : "h-11 w-11 text-base";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-rosa-claro font-extrabold text-rosa-activo ${tamano}`}
    >
      {iniciales(nombre)}
    </span>
  );
}

function Cifra({ titulo, valor, nota, tono = "ok" }: { titulo: string; valor: string; nota: string; tono?: "ok" | "suave" | "alerta" }) {
  const color = { ok: "text-ok", suave: "text-suave", alerta: "text-alerta" }[tono];
  return (
    <div className="flex flex-col gap-1 rounded-[22px] border border-borde bg-fondo p-4">
      <span className="text-[13px] font-bold text-suave">{titulo}</span>
      <span className="text-xl font-extrabold">{valor}</span>
      <span className={`text-xs font-extrabold ${color}`}>{nota}</span>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-bold text-suave">{etiqueta}</span>
      <span className="text-[15px] font-bold break-words">{valor || "—"}</span>
    </div>
  );
}

export default function FichaCliente({
  ficha,
  alEditar,
  alArchivar,
  alRecuperar,
}: {
  ficha: ClienteFicha;
  alEditar: () => void;
  alArchivar: () => Promise<void>;
  alRecuperar: () => Promise<void>;
}) {
  const desde = `Clienta desde el ${fecha(ficha.creado)}`;
  const ultima = ficha.ultima_compra ? ` · última compra el ${fecha(ficha.ultima_compra)}` : "";
  const direccion = [ficha.direccion, ficha.ciudad].filter(Boolean).join(", ");

  return (
    <section aria-label={`Ficha de ${ficha.nombre}`} className="flex min-w-0 flex-col gap-5 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={ficha.nombre} grande />
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
          <h2 className="truncate font-titulo text-[28px] leading-[1.15] font-semibold">{ficha.nombre}</h2>
          <span className="text-sm text-suave">{desde + ultima}</span>
          {!ficha.activo && <span className="self-start rounded-full bg-alerta-fondo px-2.5 py-1 text-xs font-extrabold text-alerta">Archivada</span>}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={ficha.enlace_whatsapp}
            target="_blank"
            rel="noopener"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-rosa px-[22px] text-[15px] font-extrabold text-white no-underline shadow-boton hover:bg-rosa-activo hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
          >
            <IconoWhatsapp tamano={18} />
            Escribir por WhatsApp
          </a>
          <button
            type="button"
            aria-label="Editar clienta"
            title="Editar clienta"
            onClick={alEditar}
            className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media hover:border-rosa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
          >
            <IconoEditar />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra titulo="Total comprado" valor={pesos(ficha.total_comprado)} nota={ficha.compras === 1 ? "1 compra" : `${ficha.compras} compras`} />
        <Cifra
          titulo="Por cobrar"
          valor={pesos(ficha.por_cobrar)}
          nota={ficha.por_cobrar > 0 ? "Tiene saldo pendiente" : "Está al día"}
          tono={ficha.por_cobrar > 0 ? "alerta" : "ok"}
        />
        <Cifra
          titulo="Compra promedio"
          valor={pesos(ficha.promedio)}
          nota={ficha.canal_frecuente ? `Casi siempre por ${nombreCanal(ficha.canal_frecuente)}` : "Todavía no ha comprado"}
          tono="suave"
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-3.5 rounded-[20px] border border-borde px-[18px] py-4">
        <Dato etiqueta="WhatsApp" valor={telefono(ficha.whatsapp)} />
        <Dato etiqueta="Instagram o TikTok" valor={ficha.instagram} />
        <Dato etiqueta="Correo" valor={ficha.correo} />
        <Dato etiqueta="Dirección de envío" valor={direccion} />
        <Dato etiqueta="Cédula" valor={ficha.cedula} />
        <Dato etiqueta="Notas" valor={ficha.notas} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-[19px] font-extrabold">Historial de compras</h3>
        {ficha.historial.length === 0 ? (
          <p className="py-3 text-sm text-suave">Todavía no tiene compras.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-suave">
                <th scope="col" className="hidden px-2 py-2.5 font-extrabold sm:table-cell">Fecha</th>
                <th scope="col" className="px-2 py-2.5 font-extrabold">Venta</th>
                <th scope="col" className="hidden px-2 py-2.5 font-extrabold md:table-cell">Productos</th>
                <th scope="col" className="px-2 py-2.5 text-right font-extrabold">Total</th>
                <th scope="col" className="hidden px-2 py-2.5 font-extrabold sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ficha.historial.map((h) => {
                const [texto, clases] = ESTADOS[h.estado] ?? [h.estado, "bg-rosa-claro text-rosa-oscuro"];
                return (
                  <tr key={h.id} className="border-t border-borde">
                    <td className="hidden px-2 py-3 whitespace-nowrap sm:table-cell">{fecha(h.fecha)}</td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <Link to={`/ventas/${h.id}`} className="font-extrabold no-underline">{`N.º ${h.numero}`}</Link>
                      {/* En el celular no caben cinco columnas: fecha y estado van aquí debajo. */}
                      <span className="block text-xs text-suave sm:hidden">
                        {fecha(h.fecha)}
                        {h.estado === "cancelado" && <span className="ml-1.5 font-extrabold text-peligro">Anulada</span>}
                      </span>
                    </td>
                    <td className="hidden px-2 py-3 md:table-cell">{h.productos}</td>
                    <td className="px-2 py-3 text-right font-extrabold whitespace-nowrap">{pesos(h.total)}</td>
                    <td className="hidden px-2 py-3 sm:table-cell">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${clases}`}>{texto}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-borde pt-4">
        {ficha.activo ? (
          <Archivar boton="Archivar clienta" nombre={ficha.nombre} alArchivar={alArchivar} />
        ) : (
          <BotonSecundario onClick={alRecuperar}>Recuperar clienta</BotonSecundario>
        )}
      </div>
    </section>
  );
}
