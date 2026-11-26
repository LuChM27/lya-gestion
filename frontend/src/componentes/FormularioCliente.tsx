import { useState, type FormEvent } from "react";
import { actualizar, enviar, ErrorApi } from "../api";
import type { ClienteFicha } from "../clientes";
import { telefono } from "../formato";
import { Boton, BotonSecundario, Campo, MensajeError } from "./Formulario";

type Opcional = "instagram" | "correo" | "direccion" | "ciudad" | "cedula" | "notas";

const OPCIONALES: [Opcional, string][] = [
  ["instagram", "Instagram o TikTok"],
  ["correo", "Correo"],
  ["direccion", "Dirección de envío"],
  ["ciudad", "Ciudad"],
  ["cedula", "Cédula"],
  ["notas", "Notas"],
];

/** Crear o editar una clienta. Con `soloBasico` pide solo nombre y WhatsApp (venta rápida). */
export default function FormularioCliente({
  inicial,
  alCancelar,
  alGuardar,
  soloBasico = false,
}: {
  inicial?: ClienteFicha;
  alCancelar: () => void;
  alGuardar: (c: ClienteFicha) => void;
  soloBasico?: boolean;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial ? telefono(inicial.whatsapp) : "");
  const [extra, setExtra] = useState<Record<Opcional, string>>(() => ({
    instagram: inicial?.instagram ?? "",
    correo: inicial?.correo ?? "",
    direccion: inicial?.direccion ?? "",
    ciudad: inicial?.ciudad ?? "",
    cedula: inicial?.cedula ?? "",
    notas: inicial?.notas ?? "",
  }));
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nombre.trim()) return setError("Escribe el nombre de la clienta.");
    if (!whatsapp.trim()) return setError("Escribe su WhatsApp.");
    const cuerpo = {
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim(),
      ...Object.fromEntries(OPCIONALES.map(([k]) => [k, extra[k].trim() || null])),
    };
    setEnviando(true);
    try {
      const c = inicial ? await actualizar<ClienteFicha>(`/api/clientes/${inicial.id}`, cuerpo) : await enviar<ClienteFicha>("/api/clientes", cuerpo);
      alGuardar(c);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col">
      <div className={soloBasico ? "" : "grid gap-x-4 md:grid-cols-2"}>
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => (setNombre(e.target.value), setError(""))} autoComplete="off" maxLength={120} />
        <Campo etiqueta="WhatsApp" value={whatsapp} onChange={(e) => (setWhatsapp(e.target.value), setError(""))} inputMode="tel" autoComplete="off" maxLength={30} />
        {!soloBasico &&
          OPCIONALES.map(([k, etiqueta]) => (
            <Campo
              key={k}
              etiqueta={etiqueta}
              required={false}
              value={extra[k]}
              onChange={(e) => setExtra((x) => ({ ...x, [k]: e.target.value }))}
              type={k === "correo" ? "email" : "text"}
              maxLength={200}
            />
          ))}
      </div>
      <MensajeError texto={error} />
      <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
        <Boton type="submit" disabled={enviando} className="sm:w-auto">
          Guardar clienta
        </Boton>
        <BotonSecundario onClick={alCancelar} className="h-14">
          Cancelar
        </BotonSecundario>
      </div>
    </form>
  );
}
