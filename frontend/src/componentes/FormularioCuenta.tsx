import { useState, type FormEvent } from "react";
import { actualizar, borrar, enviar, ErrorApi } from "../api";
import { leerPesos, type CuentaSaldo } from "../dinero";
import { pesos } from "../formato";
import Archivar from "./Archivar";
import { Boton, BotonSecundario, Campo, MensajeError } from "./Formulario";

/** Agregar o editar una cuenta de dinero (nombre y saldo inicial que ella misma llena). */
export default function FormularioCuenta({ inicial, alGuardar, alCancelar }: { inicial?: CuentaSaldo; alGuardar: () => void; alCancelar: () => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [saldoInicial, setSaldoInicial] = useState(inicial ? pesos(inicial.saldo_inicial) : "");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nombre.trim()) return setError("Escribe el nombre de la cuenta, por ejemplo Bancolombia.");
    const valor = saldoInicial.trim() ? leerPesos(saldoInicial) : 0;
    if (valor === null) return setError("Escribe el saldo en pesos, por ejemplo 300.000.");
    const cuerpo = { nombre: nombre.trim(), saldo_inicial: valor };
    setEnviando(true);
    try {
      if (inicial) await actualizar(`/api/cuentas/${inicial.id}`, cuerpo);
      else await enviar("/api/cuentas", cuerpo);
      alGuardar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  const titulo = inicial ? "Editar cuenta" : "Nueva cuenta";
  return (
    <section aria-label={titulo} className="flex flex-col gap-4 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6">
      <h2 className="font-titulo text-[26px] font-semibold">{titulo}</h2>
      <form onSubmit={guardar} noValidate className="flex flex-col">
        <div className="grid gap-x-4 md:grid-cols-2">
          <Campo etiqueta="Nombre" value={nombre} onChange={(e) => (setNombre(e.target.value), setError(""))} maxLength={60} autoComplete="off" />
          <Campo etiqueta="Saldo inicial" required={false} value={saldoInicial} onChange={(e) => (setSaldoInicial(e.target.value), setError(""))} inputMode="numeric" placeholder="$ 0" />
        </div>
        <MensajeError texto={error} />
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-start">
          <Boton type="submit" disabled={enviando} className="sm:w-auto">
            Guardar cuenta
          </Boton>
          <BotonSecundario onClick={alCancelar} className="h-14">
            Cancelar
          </BotonSecundario>
        </div>
      </form>
      {inicial && (
        <div className="border-t border-borde pt-4">
          <Archivar
            boton="Archivar cuenta"
            nombre={inicial.nombre}
            alArchivar={async () => {
              await borrar(`/api/cuentas/${inicial.id}`);
              alGuardar();
            }}
          />
        </div>
      )}
    </section>
  );
}
