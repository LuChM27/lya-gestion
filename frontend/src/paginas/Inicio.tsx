import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pedir } from "../api";
import AccesoCelular from "../componentes/AccesoCelular";
import type { EstadoStock } from "../componentes/Estado";
import { Boton } from "../componentes/Formulario";
import { pesos } from "../formato";
import type { DiaVentas } from "../ventas";

type Pendientes = { productos: number; insumos: number };

const porRevisar = (lista: { estado: EstadoStock }[]) => lista.filter((x) => x.estado !== "ok").length;

function VentasDeHoy() {
  const [hoy, setHoy] = useState<DiaVentas | null>(null);

  useEffect(() => {
    pedir<DiaVentas>("/api/ventas")
      .then(setHoy)
      .catch(() => setHoy(null)); // opcional, como el resumen de inventario
  }, []);

  if (!hoy) return null;
  return (
    <Link
      to="/ventas"
      className="mb-4 flex min-h-11 items-center rounded-2xl border border-borde bg-superficie p-4 font-bold focus-visible:outline-2 focus-visible:outline-rosa"
    >
      {`Ventas de hoy: ${pesos(hoy.total)} (${hoy.cantidad})`}
    </Link>
  );
}

function Resumen() {
  const [pendientes, setPendientes] = useState<Pendientes | null>(null);

  useEffect(() => {
    Promise.all([
      pedir<{ estado: EstadoStock }[]>("/api/inventario/modelos"),
      pedir<{ estado: EstadoStock }[]>("/api/inventario/insumos"),
    ])
      .then(([modelos, insumos]) => setPendientes({ productos: porRevisar(modelos), insumos: porRevisar(insumos) }))
      .catch(() => setPendientes(null)); // el resumen es opcional: si falla, Inicio sigue sirviendo
  }, []);

  if (!pendientes) return null;
  if (pendientes.productos === 0 && pendientes.insumos === 0) {
    return <p className="mb-6 rounded-2xl border border-borde bg-superficie p-4">Todo el inventario está en orden.</p>;
  }
  const tarjetas = [
    { n: pendientes.productos, texto: pendientes.productos === 1 ? "1 producto por revisar" : `${pendientes.productos} productos por revisar`, a: "/productos" },
    { n: pendientes.insumos, texto: pendientes.insumos === 1 ? "1 insumo por revisar" : `${pendientes.insumos} insumos por revisar`, a: "/insumos" },
  ].filter((t) => t.n > 0);
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {tarjetas.map((t) => (
        <Link
          key={t.a}
          to={t.a}
          className="flex min-h-11 items-center rounded-2xl border border-alerta bg-alerta-fondo p-4 font-bold text-alerta focus-visible:outline-2 focus-visible:outline-rosa"
        >
          {t.texto}
        </Link>
      ))}
    </div>
  );
}

export default function Inicio({ usuario }: { usuario: string }) {
  const [verCelular, setVerCelular] = useState(false);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Hola, {usuario}</h1>
      <VentasDeHoy />
      <Resumen />
      <div className="max-w-xs">
        <Boton onClick={() => setVerCelular((v) => !v)} aria-expanded={verCelular}>
          Entrar desde el celular
        </Boton>
      </div>
      {verCelular && (
        <section className="mt-6 rounded-2xl border border-borde bg-superficie p-6">
          <AccesoCelular />
        </section>
      )}
    </>
  );
}
