import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { borrar, enviar, ErrorApi, pedir } from "../api";
import Confirmar from "../componentes/Confirmar";
import { Boton, BotonSecundario, Campo, MensajeError } from "../componentes/Formulario";
import FormularioCuenta from "../componentes/FormularioCuenta";
import FormularioGastoFijo from "../componentes/FormularioGastoFijo";
import FormularioMovimiento, { type Prellenado } from "../componentes/FormularioMovimiento";
import { IconoCuentas, IconoSiguiente, IconoSumar, IconoTransferir, IconoVentas, IconoVolver } from "../componentes/iconos";
import { BotonPastilla, BotonPrincipal, Encabezado, Pastillas } from "../componentes/ui";
import { mesActual, mesAnterior, mesSiguiente, nombreMes, saldo, ultimoDia, type Compra, type CuentaSaldo, type GastoFijo, type Movimiento, type ResumenMes, type TipoMovimiento } from "../dinero";
import { fecha, pesos } from "../formato";
import { hoyBogota, type Cuenta } from "../ventas";

// Mis cuentas, copiada de docs/mockups/fuentes/cuentas-mac.html.
const TARJETA = "flex min-w-0 flex-col gap-3 rounded-[28px] border border-borde bg-superficie p-5 shadow-tarjeta md:px-[26px] md:py-6";
const TONOS = [
  "bg-alerta-fondo text-alerta",
  "bg-rosa-claro text-rosa-activo",
  "bg-lila-fondo text-lila-texto",
  "bg-ok-fondo text-ok",
];
const SECUNDARIO_CHICO =
  "inline-flex h-11 items-center rounded-full border-[1.5px] border-rosa-palo bg-superficie px-4 text-sm font-extrabold whitespace-nowrap text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa";

type Formulario =
  | { cual: "movimiento"; tipo: TipoMovimiento; inicial?: Movimiento; prellenado?: Prellenado }
  | { cual: "cuenta"; inicial?: CuentaSaldo }
  | null;

function Titulo2({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[17px] font-extrabold md:text-[19px]">{children}</h2>
      {extra}
    </div>
  );
}

function Pendiente({ titulo, detalle, children }: { titulo: string; detalle: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-borde bg-superficie px-3.5 py-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-alerta-fondo">
        <span className="h-2.5 w-2.5 rounded-full bg-dorado" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm font-extrabold">{titulo}</span>
        <span className="truncate text-xs text-suave">{detalle}</span>
      </span>
      {children}
    </div>
  );
}

function CompraPendiente({ compra, cuentas, alPagar }: { compra: Compra; cuentas: Cuenta[]; alPagar: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [cuenta, setCuenta] = useState("");
  const hoy = hoyBogota();
  const [dia, setDia] = useState(hoy);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function pagar() {
    if (enviando) return;
    if (!cuenta) return setError("Elige de qué cuenta salió.");
    setEnviando(true);
    try {
      await enviar(`/api/compras/${compra.id}/pago`, { cuenta_id: Number(cuenta), fecha: dia === hoy ? null : dia });
      alPagar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
      setEnviando(false);
    }
  }

  const titulo = `${compra.proveedor ?? "Compra"} · ${pesos(compra.total)}`;
  return (
    <div className="flex flex-col gap-3">
      <Pendiente titulo={titulo} detalle={`Compra N.º ${compra.numero} · ${fecha(compra.fecha)}`}>
        {!abierta && (
          <button type="button" onClick={() => setAbierta(true)} className={SECUNDARIO_CHICO}>
            Registrar pago
          </button>
        )}
      </Pendiente>
      {abierta && (
        <div className="flex flex-col gap-3 rounded-[18px] bg-fondo p-3.5">
          <span className="text-sm font-extrabold">¿De dónde salió?</span>
          <Pastillas etiqueta="Cuenta" opciones={cuentas.map((c) => [String(c.id), c.nombre] as const)} valor={cuenta} alElegir={(v) => (setCuenta(v), setError(""))} alto="chico" />
          <div className="max-w-[260px]">
            <Campo etiqueta="Fecha del pago" type="date" value={dia} max={hoy} onChange={(e) => setDia(e.target.value || hoy)} />
          </div>
          <MensajeError texto={error} />
          <div className="flex flex-wrap gap-2.5">
            <Boton onClick={pagar} disabled={enviando} className="h-11 w-auto px-5 text-[15px]">
              Guardar pago
            </Boton>
            <BotonSecundario onClick={() => setAbierta(false)}>Cancelar</BotonSecundario>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaMovimiento({ m, alEditar, alBorrar }: { m: Movimiento; alEditar: () => void; alBorrar: () => Promise<void> }) {
  const color = m.signo === "+" ? "text-ok" : m.signo === "-" ? "text-peligro" : "text-tinta-media";
  const prefijo = m.signo === "+" ? "+ " : m.signo === "-" ? "− " : "";
  const destino = m.origen ? (m.origen.tipo === "venta" ? `/ventas/${m.origen.id}` : `/compras/${m.origen.id}`) : null;
  return (
    <li className="flex flex-col gap-2 border-t border-borde py-3 md:grid md:grid-cols-[100px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px_190px] md:items-center md:gap-3 md:px-2">
      <div className="flex items-start justify-between gap-3 md:contents">
        <span className="hidden text-sm md:block">{fecha(m.fecha)}</span>
        <span className="flex min-w-0 flex-col">
          {destino ? (
            <Link to={destino} className="truncate text-sm font-extrabold no-underline">
              {m.descripcion}
            </Link>
          ) : (
            <span className="truncate text-sm font-extrabold">{m.descripcion}</span>
          )}
          <span className="text-xs text-suave">
            <span className="md:hidden">{`${fecha(m.fecha)} · ${m.categoria ?? "Transferencia"} · ${m.cuenta_destino ? `${m.cuenta} → ${m.cuenta_destino}` : m.cuenta}`}</span>
            {m.origen && <span className="hidden md:inline">{m.origen.tipo === "venta" ? "Viene de la venta" : "Viene de la compra"}</span>}
          </span>
        </span>
        <span className="hidden text-sm md:block">{m.categoria ?? "Transferencia"}</span>
        <span className="hidden text-sm md:block">{m.cuenta_destino ? `${m.cuenta} → ${m.cuenta_destino}` : m.cuenta}</span>
        <b className={`shrink-0 text-right text-sm whitespace-nowrap ${color}`}>{prefijo + pesos(m.monto)}</b>
      </div>
      {m.editable ? (
        <div className="flex flex-wrap items-start gap-2 md:justify-end">
          <button type="button" onClick={alEditar} className={SECUNDARIO_CHICO}>
            Editar
          </button>
          <Confirmar boton="Borrar" pregunta={`¿Borrar «${m.descripcion}»? El saldo de ${m.cuenta} vuelve a como estaba.`} accion="Borrar movimiento" alConfirmar={alBorrar} />
        </div>
      ) : (
        <span className="hidden md:block" />
      )}
    </li>
  );
}

export default function Cuentas() {
  const actual = mesActual();
  const [mes, setMes] = useState(actual);
  const [filtro, setFiltro] = useState("");
  const [saldos, setSaldos] = useState<CuentaSaldo[] | null>(null);
  const [resumen, setResumen] = useState<ResumenMes | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [fijos, setFijos] = useState<GastoFijo[]>([]);
  const [sinPagar, setSinPagar] = useState<Compra[]>([]);
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [editandoFijos, setEditandoFijos] = useState(false);
  const [fijoEnEdicion, setFijoEnEdicion] = useState<GastoFijo | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const [archivadas, setArchivadas] = useState<CuentaSaldo[] | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  async function verArchivadas() {
    if (archivadas) return setArchivadas(null);
    try {
      setArchivadas(await pedir<CuentaSaldo[]>("/api/cuentas/saldos?archivadas=true"));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  async function recuperar(c: CuentaSaldo) {
    try {
      await enviar(`/api/cuentas/${c.id}/restaurar`, {});
      setArchivadas((lista) => lista?.filter((x) => x.id !== c.id) ?? null);
      recargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.mensaje : String(err));
    }
  }

  useEffect(() => {
    let vigente = true;
    const fallo = (err: unknown) => vigente && setError(err instanceof ErrorApi ? err.mensaje : String(err));
    pedir<CuentaSaldo[]>("/api/cuentas/saldos").then((s) => vigente && setSaldos(s), fallo);
    pedir<GastoFijo[]>("/api/gastos-fijos").then((f) => vigente && setFijos(f), fallo);
    pedir<Compra[]>("/api/compras?sin_pagar=true").then((c) => vigente && setSinPagar(c), fallo);
    return () => {
      vigente = false;
    };
  }, [version]);

  useEffect(() => {
    let vigente = true;
    const fallo = (err: unknown) => vigente && setError(err instanceof ErrorApi ? err.mensaje : String(err));
    pedir<ResumenMes>(`/api/cuentas/resumen?mes=${mes}`).then((r) => vigente && setResumen(r), fallo);
    return () => {
      vigente = false;
    };
  }, [mes, version]);

  useEffect(() => {
    let vigente = true;
    const ruta = `/api/movimientos?mes=${mes}${filtro ? `&cuenta_id=${filtro}` : ""}`;
    pedir<Movimiento[]>(ruta).then(
      (m) => vigente && setMovimientos(m),
      (err) => vigente && setError(err instanceof ErrorApi ? err.mensaje : String(err)),
    );
    return () => {
      vigente = false;
    };
  }, [mes, filtro, version]);

  function abrir(f: Formulario) {
    setFormulario(f);
    setError("");
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function listo() {
    setFormulario(null);
    recargar();
  }

  const total = (saldos ?? []).reduce((suma, c) => suma + c.saldo, 0);
  const cuentas = (saldos ?? []).map(({ id, nombre }) => ({ id, nombre }));
  const pendientes = fijos.filter((f) => !f.registrado_este_mes);
  const subtitulo = saldos ? `Tienes ${saldo(total)} entre ${saldos.length === 1 ? "tu cuenta" : `tus ${saldos.length} cuentas`}` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Encabezado
        fecha
        titulo="Mis cuentas"
        subtitulo={subtitulo}
        acciones={
          <>
            <BotonPastilla icono={IconoTransferir} onClick={() => abrir({ cual: "movimiento", tipo: "transferencia" })}>
              Transferir
            </BotonPastilla>
            <BotonPastilla onClick={() => abrir({ cual: "movimiento", tipo: "ingreso" })}>Otro ingreso</BotonPastilla>
            <BotonPastilla onClick={() => abrir({ cual: "movimiento", tipo: "retiro" })}>Retiro personal</BotonPastilla>
            <div className="hidden md:block">
              <BotonPastilla icono={IconoVentas} a="/compras/nueva">
                Registrar compra de insumos
              </BotonPastilla>
            </div>
            <BotonPrincipal icono={IconoSumar} a="/cuentas/gasto">
              Registrar gasto
            </BotonPrincipal>
          </>
        }
      />

      {error && (
        <p role="alert" className="font-bold text-error">
          {error}
        </p>
      )}

      {formulario?.cual === "movimiento" && (
        <FormularioMovimiento key={`${formulario.tipo}-${formulario.inicial?.id ?? "nuevo"}`} tipo={formulario.tipo} inicial={formulario.inicial} prellenado={formulario.prellenado} alGuardar={listo} alCancelar={() => setFormulario(null)} />
      )}
      {formulario?.cual === "cuenta" && <FormularioCuenta key={formulario.inicial?.id ?? "nueva"} inicial={formulario.inicial} alGuardar={listo} alCancelar={() => setFormulario(null)} />}

      <section aria-label="Saldos" className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        {saldos?.map((c, i) => (
          <article key={c.id} className="flex flex-col gap-2 rounded-3xl border border-borde bg-superficie p-5 shadow-tarjeta">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONOS[i % TONOS.length]}`}>
                <IconoCuentas />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{c.nombre}</span>
              <button
                type="button"
                aria-label={`Editar ${c.nombre}`}
                title={`Editar ${c.nombre}`}
                onClick={() => abrir({ cual: "cuenta", inicial: c })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-flecha hover:text-rosa-activo focus-visible:outline-2 focus-visible:outline-rosa"
              >
                <IconoSiguiente tamano={18} />
              </button>
            </div>
            <span className={`text-[34px] leading-tight font-extrabold tracking-[-0.01em] ${c.saldo < 0 ? "text-peligro" : ""}`}>{saldo(c.saldo)}</span>
            <span className="text-[13px] font-bold text-suave">{`Empezó en ${saldo(c.saldo_inicial)}`}</span>
          </article>
        ))}
        {saldos && (
          <button
            type="button"
            onClick={() => abrir({ cual: "cuenta" })}
            className="flex min-h-[150px] items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed border-rosa-palo bg-superficie text-[15px] font-extrabold text-rosa-oscuro focus-visible:outline-2 focus-visible:outline-rosa"
          >
            <IconoSumar tamano={18} />
            Agregar cuenta
          </button>
        )}
      </section>

      <div className="-mt-3 flex flex-col gap-2">
        <button type="button" onClick={verArchivadas} className="min-h-11 self-start text-sm font-extrabold text-rosa-oscuro">
          {archivadas ? "Ocultar cuentas archivadas" : "Ver cuentas archivadas"}
        </button>
        {archivadas?.length === 0 && <p className="text-sm text-suave">No tienes cuentas archivadas.</p>}
        {archivadas?.map((c) => (
          <Pendiente key={c.id} titulo={c.nombre} detalle={`Archivada · saldo ${saldo(c.saldo)}`}>
            <button type="button" aria-label={`Recuperar ${c.nombre}`} onClick={() => recuperar(c)} className={SECUNDARIO_CHICO}>
              Recuperar
            </button>
          </Pendiente>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-label="Resumen del mes" className={TARJETA}>
          <Titulo2
            extra={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => setMes(mesAnterior(mes))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media focus-visible:outline-2 focus-visible:outline-rosa"
                >
                  <IconoVolver tamano={18} />
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  disabled={mes >= actual}
                  onClick={() => setMes(mesSiguiente(mes))}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-borde-campo bg-superficie text-tinta-media focus-visible:outline-2 focus-visible:outline-rosa disabled:border-borde disabled:text-flecha"
                >
                  <IconoSiguiente tamano={18} />
                </button>
              </div>
            }
          >
            {`Resumen de ${nombreMes(mes)}`}
          </Titulo2>
          {resumen && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-[22px] bg-ok-fondo p-4">
                  <span className="text-[13px] font-bold text-ok">Entró</span>
                  <span className="text-xl font-extrabold">{pesos(resumen.entro)}</span>
                  <span className="text-xs font-extrabold text-ok">Ventas y otros ingresos</span>
                </div>
                <div className="flex flex-col gap-1 rounded-[22px] bg-peligro-fondo p-4">
                  <span className="text-[13px] font-bold text-peligro">Salió</span>
                  <span className="text-xl font-extrabold">{pesos(resumen.salio)}</span>
                  <span className="text-xs font-extrabold text-peligro">Gastos del negocio</span>
                </div>
                <div className="flex flex-col gap-1 rounded-[22px] bg-rosa p-4 text-white shadow-boton-grande">
                  <span className="text-[13px] font-bold">Ganancia</span>
                  <span className="text-xl font-extrabold">{saldo(resumen.ganancia)}</span>
                  <span className="text-xs font-extrabold">Entró menos salió</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-xs font-extrabold tracking-[0.08em] text-suave uppercase">Gastos por categoría</span>
                {resumen.por_categoria.length === 0 && <span className="text-sm text-suave">Sin gastos este mes.</span>}
                {resumen.por_categoria.map((c) => (
                  <div key={c.categoria} className="flex justify-between gap-3 text-sm">
                    <span className="text-tinta-media">{c.categoria}</span>
                    <b>{pesos(c.monto)}</b>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-borde pt-2 text-sm">
                  <span className="text-tinta-media">Retiros personales (no cuentan como gasto)</span>
                  <b className="whitespace-nowrap">{pesos(resumen.retiros)}</b>
                </div>
                <span className="pt-2 text-xs font-extrabold tracking-[0.08em] text-suave uppercase">{`Saldo al ${ultimoDia(mes)}`}</span>
                {resumen.saldos_al_cierre.map((s) => (
                  <div key={s.cuenta} className="flex justify-between gap-3 text-sm">
                    <span className="text-tinta-media">{s.cuenta}</span>
                    <b className={s.saldo < 0 ? "text-peligro" : ""}>{saldo(s.saldo)}</b>
                  </div>
                ))}
                <Link to="/cuentas/categorias" className="self-start pt-2 text-sm font-extrabold no-underline">
                  Editar categorías
                </Link>
              </div>
            </>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Gastos fijos" className={TARJETA}>
            <Titulo2
              extra={
                <button type="button" onClick={() => (setEditandoFijos((v) => !v), setFijoEnEdicion(null))} className="min-h-11 text-sm font-extrabold text-rosa-oscuro">
                  {editandoFijos ? "Listo" : "Editar"}
                </button>
              }
            >
              {`Gastos fijos de ${nombreMes(actual)}`}
            </Titulo2>
            {editandoFijos ? (
              <>
                {fijos.map((f) =>
                  fijoEnEdicion !== "nuevo" && fijoEnEdicion?.id === f.id ? (
                    <FormularioGastoFijo key={f.id} inicial={f} alGuardar={() => (setFijoEnEdicion(null), recargar())} alCancelar={() => setFijoEnEdicion(null)} />
                  ) : (
                    <Pendiente key={f.id} titulo={f.nombre} detalle={`Unos ${pesos(f.monto)} · ${f.categoria}${f.cuenta ? ` · de ${f.cuenta}` : ""}`}>
                      <button type="button" aria-label={`Editar ${f.nombre}`} onClick={() => setFijoEnEdicion(f)} className={SECUNDARIO_CHICO}>
                        Editar
                      </button>
                    </Pendiente>
                  ),
                )}
                {fijoEnEdicion === "nuevo" ? (
                  <FormularioGastoFijo alGuardar={() => (setFijoEnEdicion(null), recargar())} alCancelar={() => setFijoEnEdicion(null)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFijoEnEdicion("nuevo")}
                    className="flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-rosa-palo bg-superficie text-sm font-extrabold text-rosa-oscuro"
                  >
                    <IconoSumar tamano={16} />
                    Agregar gasto fijo
                  </button>
                )}
              </>
            ) : fijos.length === 0 ? (
              <p className="text-sm text-suave">Anota aquí lo que pagas cada mes, como internet o el plan del celular. Nunca se descuenta solo.</p>
            ) : pendientes.length === 0 ? (
              <p className="text-sm text-suave">Ya registraste todos los gastos fijos de este mes.</p>
            ) : (
              pendientes.map((f) => (
                <Pendiente key={f.id} titulo={f.nombre} detalle={`Unos ${pesos(f.monto)}${f.cuenta ? ` · de ${f.cuenta}` : ""}`}>
                  <button
                    type="button"
                    aria-label={`Registrar ${f.nombre}`}
                    onClick={() =>
                      abrir({
                        cual: "movimiento",
                        tipo: "gasto",
                        prellenado: { monto: f.monto, categoria_id: f.categoria_id, cuenta_id: f.cuenta_id, gasto_fijo_id: f.id },
                      })
                    }
                    className={SECUNDARIO_CHICO}
                  >
                    Registrar
                  </button>
                </Pendiente>
              ))
            )}
          </section>

          {sinPagar.length > 0 && (
            <section aria-label="Compras sin pagar" className={TARJETA}>
              <Titulo2
                extra={
                  <Link to="/compras" className="text-sm font-extrabold no-underline">
                    Ver compras
                  </Link>
                }
              >
                Compras sin pagar
              </Titulo2>
              {sinPagar.map((c) => (
                <CompraPendiente key={c.id} compra={c} cuentas={cuentas} alPagar={recargar} />
              ))}
            </section>
          )}
        </div>
      </div>

      <section aria-label="Movimientos" className={TARJETA}>
        <Titulo2 extra={<Pastillas etiqueta="Cuenta" opciones={[["", "Todas"] as const, ...cuentas.map((c) => [String(c.id), c.nombre] as const)]} valor={filtro} alElegir={setFiltro} alto="chico" />}>
          {`Movimientos de ${nombreMes(mes)}`}
        </Titulo2>
        {movimientos?.length === 0 ? (
          <p className="py-3 text-sm text-suave">No hay movimientos en este mes.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[100px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px_190px] gap-3 px-2 pb-1 text-[13px] font-extrabold text-suave md:grid">
              <span>Fecha</span>
              <span>Movimiento</span>
              <span>Categoría</span>
              <span>Cuenta</span>
              <span className="text-right">Monto</span>
              <span />
            </div>
            <ul className="flex flex-col">
              {movimientos?.map((m) => (
                <FilaMovimiento
                  key={m.id}
                  m={m}
                  alEditar={() =>
                    abrir({
                      cual: "movimiento",
                      tipo: m.tipo === "transferencia" ? "transferencia" : m.tipo === "ingreso" ? "ingreso" : m.categoria === "Retiro personal" ? "retiro" : "gasto",
                      inicial: m,
                    })
                  }
                  alBorrar={async () => {
                    await borrar(`/api/movimientos/${m.id}`);
                    recargar();
                  }}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
