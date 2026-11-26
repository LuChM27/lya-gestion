import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { mesActual, mesAnterior } from "../dinero";
import { simularApi } from "../pruebas/simular";
import Cuentas from "./Cuentas";

function Destino({ texto }: { texto: string }) {
  return <p>{`${texto} ${useParams().id ?? ""}`}</p>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/cuentas"]}>
      <Routes>
        <Route path="/cuentas" element={<Cuentas />} />
        <Route path="/ventas/:id" element={<Destino texto="Venta" />} />
        <Route path="/compras/:id" element={<Destino texto="Compra" />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

const MES = mesActual();
const SALDOS = [
  { id: 1, nombre: "Efectivo", saldo_inicial: 300000, saldo: 642000, activa: true },
  { id: 2, nombre: "Nequi", saldo_inicial: 0, saldo: 1318000, activa: true },
  { id: 3, nombre: "Daviplata", saldo_inicial: 0, saldo: -20000, activa: true },
];
const CUENTAS = SALDOS.map(({ id, nombre }) => ({ id, nombre }));
const RESUMEN = {
  mes: MES,
  entro: 1986000,
  salio: 740000,
  ganancia: 1246000,
  retiros: 400000,
  por_categoria: [{ categoria: "Insumos", monto: 412000 }],
  saldos_al_cierre: [{ cuenta: "Efectivo", saldo: 642000 }],
};
const GASTO = { id: 40, fecha: "2026-11-25T15:00:00Z", tipo: "egreso", descripcion: "Stand Feria Artesanal", categoria: "Stand de feria", cuenta: "Efectivo", cuenta_destino: null, monto: 150000, signo: "-", editable: true, origen: null, nota: "Stand Feria Artesanal", cuenta_id: 1, cuenta_destino_id: null, categoria_id: 8, gasto_fijo_id: null };
const VENTA = { ...GASTO, id: 41, tipo: "ingreso", descripcion: "Venta N.º 0012", categoria: "Ventas", cuenta: "Nequi", monto: 125000, signo: "+", editable: false, origen: { tipo: "venta", id: 12, numero: "0012" } };
const FIJO = { id: 7, nombre: "Internet", monto: 85000, categoria_id: 15, categoria: "Servicios", cuenta_id: 2, cuenta: "Nequi", activo: true, registrado_este_mes: false };
const COMPRA = { id: 7, numero: "0007", fecha: "2026-11-23T15:00:00Z", proveedor: "Hilos La 14", total: 66000, estado: "activa", nota: null, cuenta: null, pagada_el: null, items: [] };
const CATEGORIAS = [
  { id: 14, nombre: "Publicidad", tipo: "gasto", activa: true, protegida: false },
  { id: 15, nombre: "Servicios", tipo: "gasto", activa: true, protegida: false },
];

function api(extra = {}) {
  return simularApi({
    "GET /api/cuentas/saldos": { cuerpo: SALDOS },
    [`GET /api/cuentas/resumen?mes=${MES}`]: { cuerpo: RESUMEN },
    [`GET /api/movimientos?mes=${MES}`]: { cuerpo: [GASTO, VENTA] },
    "GET /api/gastos-fijos": { cuerpo: [FIJO] },
    "GET /api/compras?sin_pagar=true": { cuerpo: [COMPRA] },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "GET /api/categorias?tipo=gasto": { cuerpo: CATEGORIAS },
    ...extra,
  });
}

test("muestra saldos y el total", async () => {
  api();
  montar();
  const saldos = within(await screen.findByRole("region", { name: "Saldos" }));
  expect(await saldos.findByText("$ 642.000")).toBeInTheDocument();
  expect(saldos.getByText("Nequi")).toBeInTheDocument();
  expect(screen.getByText("Tienes $ 1.940.000 entre tus 3 cuentas")).toBeInTheDocument();
  expect(saldos.getByText("-$ 20.000")).toHaveClass("text-peligro");
});

test("resumen del mes con navegación", async () => {
  const anterior = mesAnterior(MES);
  const llamadas = api({
    [`GET /api/cuentas/resumen?mes=${anterior}`]: { cuerpo: { ...RESUMEN, mes: anterior } },
    [`GET /api/movimientos?mes=${anterior}`]: { cuerpo: [] },
  });
  montar();
  const resumen = within(await screen.findByRole("region", { name: "Resumen del mes" }));
  expect(await resumen.findByText("$ 1.986.000")).toBeInTheDocument();
  expect(resumen.getByText("$ 1.246.000")).toBeInTheDocument();
  expect(resumen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  await userEvent.click(resumen.getByRole("button", { name: "Mes anterior" }));
  await vi.waitFor(() => {
    const claves = llamadas.map((l) => l.clave);
    expect(claves).toContain(`GET /api/cuentas/resumen?mes=${anterior}`);
    expect(claves).toContain(`GET /api/movimientos?mes=${anterior}`);
  });
});

test("filtra movimientos por cuenta", async () => {
  const llamadas = api({ [`GET /api/movimientos?mes=${MES}&cuenta_id=2`]: { cuerpo: [VENTA] } });
  montar();
  const movimientos = within(await screen.findByRole("region", { name: "Movimientos" }));
  await userEvent.click(await movimientos.findByRole("button", { name: "Nequi" }));
  await vi.waitFor(() => expect(llamadas.map((l) => l.clave)).toContain(`GET /api/movimientos?mes=${MES}&cuenta_id=2`));
});

test("movimiento de venta sin botones y con enlace", async () => {
  const llamadas = api({ "DELETE /api/movimientos/40": { estado: 204 } });
  montar();
  const movimientos = within(await screen.findByRole("region", { name: "Movimientos" }));
  const venta = (await movimientos.findByRole("link", { name: /Venta N\.º 0012/ })).closest("li")!;
  expect(within(venta).getByRole("link", { name: /Venta N\.º 0012/ })).toHaveAttribute("href", "/ventas/12");
  expect(within(venta).queryByRole("button", { name: /Editar|Borrar/ })).not.toBeInTheDocument();
  const gasto = movimientos.getByText("Stand Feria Artesanal").closest("li")!;
  await userEvent.click(within(gasto).getByRole("button", { name: "Borrar" }));
  await userEvent.click(within(gasto).getByRole("button", { name: "Borrar movimiento" }));
  await vi.waitFor(() => expect(llamadas.map((l) => l.clave)).toContain("DELETE /api/movimientos/40"));
});

test("registrar un gasto fijo prellena el formulario", async () => {
  const llamadas = api({ "POST /api/movimientos": { estado: 201, cuerpo: GASTO } });
  montar();
  const fijos = within(await screen.findByRole("region", { name: "Gastos fijos" }));
  await userEvent.click(await fijos.findByRole("button", { name: "Registrar Internet" }));
  const formulario = within(await screen.findByRole("region", { name: "Registrar gasto" }));
  expect(formulario.getByLabelText("Monto")).toHaveValue("$ 85.000");
  expect(await formulario.findByRole("button", { name: "Servicios" })).toHaveAttribute("aria-pressed", "true");
  expect(await formulario.findByRole("button", { name: "Nequi" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(formulario.getByRole("button", { name: "Guardar gasto" }));
  await vi.waitFor(() => {
    const post = llamadas.find((l) => l.clave === "POST /api/movimientos");
    expect(post?.cuerpo).toMatchObject({ tipo: "gasto", monto: 85000, categoria_id: 15, cuenta_id: 2, gasto_fijo_id: 7 });
  });
});

test("transferir a la misma cuenta avisa sin llamar al servidor", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Transferir" }));
  const formulario = within(await screen.findByRole("region", { name: "Transferir" }));
  await userEvent.type(formulario.getByLabelText("Monto"), "100000");
  await userEvent.click(within(await formulario.findByRole("group", { name: "De" })).getByRole("button", { name: "Efectivo" }));
  await userEvent.click(within(formulario.getByRole("group", { name: "A" })).getByRole("button", { name: "Efectivo" }));
  await userEvent.click(formulario.getByRole("button", { name: "Guardar transferencia" }));
  expect(formulario.getByText("Elige dos cuentas distintas.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave === "POST /api/movimientos")).toBe(false);
});

test("agregar cuenta", async () => {
  const llamadas = api({ "POST /api/cuentas": { estado: 201, cuerpo: { id: 4, nombre: "Bancolombia", saldo_inicial: 300000, saldo: 300000, activa: true } } });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Agregar cuenta" }));
  const formulario = within(screen.getByRole("region", { name: "Nueva cuenta" }));
  await userEvent.type(formulario.getByLabelText("Nombre"), "Bancolombia");
  await userEvent.type(formulario.getByLabelText("Saldo inicial"), "300.000");
  await userEvent.click(formulario.getByRole("button", { name: "Guardar cuenta" }));
  await vi.waitFor(() => {
    const post = llamadas.find((l) => l.clave === "POST /api/cuentas");
    expect(post?.cuerpo).toEqual({ nombre: "Bancolombia", saldo_inicial: 300000 });
  });
});

test("compra sin pagar: registrar pago", async () => {
  const llamadas = api({ "POST /api/compras/7/pago": { cuerpo: { ...COMPRA, cuenta: { id: 1, nombre: "Efectivo" } } } });
  montar();
  const compras = within(await screen.findByRole("region", { name: "Compras sin pagar" }));
  await userEvent.click(await compras.findByRole("button", { name: "Registrar pago" }));
  await userEvent.click(await compras.findByRole("button", { name: "Efectivo" }));
  await userEvent.click(compras.getByRole("button", { name: "Guardar pago" }));
  await vi.waitFor(() => {
    const post = llamadas.find((l) => l.clave === "POST /api/compras/7/pago");
    expect(post?.cuerpo).toEqual({ cuenta_id: 1, fecha: null });
  });
});

test("editar un gasto fijo con cuenta archivada conserva todo", async () => {
  const internet = { ...GASTO, id: 42, descripcion: "Internet", nota: null, categoria: "Servicios", categoria_id: 15, cuenta: "Daviplata vieja", cuenta_id: 9, gasto_fijo_id: 7 };
  const llamadas = api({ [`GET /api/movimientos?mes=${MES}`]: { cuerpo: [internet] }, "PUT /api/movimientos/42": { cuerpo: internet } });
  montar();
  const movimientos = within(await screen.findByRole("region", { name: "Movimientos" }));
  const fila = (await movimientos.findByText("Internet")).closest("li")!;
  await userEvent.click(within(fila).getByRole("button", { name: "Editar" }));
  const formulario = within(await screen.findByRole("region", { name: "Editar movimiento" }));
  expect(await formulario.findByRole("button", { name: "Daviplata vieja" })).toHaveAttribute("aria-pressed", "true");
  expect(formulario.getByLabelText("Nota (opcional)")).toHaveValue("");
  await userEvent.click(formulario.getByRole("button", { name: "Guardar cambios" }));
  await vi.waitFor(() => {
    const put = llamadas.find((l) => l.clave === "PUT /api/movimientos/42");
    expect(put?.cuerpo).toMatchObject({ cuenta_id: 9, categoria_id: 15, gasto_fijo_id: 7, nota: null });
  });
});

test("ver y recuperar cuentas archivadas", async () => {
  const llamadas = api({
    "GET /api/cuentas/saldos?archivadas=true": { cuerpo: [{ id: 9, nombre: "Daviplata vieja", saldo_inicial: 0, saldo: 5000, activa: false }] },
    "POST /api/cuentas/9/restaurar": { cuerpo: { id: 9, nombre: "Daviplata vieja", saldo_inicial: 0, saldo: 5000, activa: true } },
  });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Ver cuentas archivadas" }));
  await userEvent.click(await screen.findByRole("button", { name: "Recuperar Daviplata vieja" }));
  await vi.waitFor(() => expect(llamadas.map((l) => l.clave)).toContain("POST /api/cuentas/9/restaurar"));
});

test("el pago de una compra puede ser de otro día", async () => {
  const llamadas = api({ "POST /api/compras/7/pago": { cuerpo: { ...COMPRA, cuenta: { id: 1, nombre: "Efectivo" } } } });
  montar();
  const compras = within(await screen.findByRole("region", { name: "Compras sin pagar" }));
  await userEvent.click(await compras.findByRole("button", { name: "Registrar pago" }));
  await userEvent.click(await compras.findByRole("button", { name: "Efectivo" }));
  fireEvent.change(compras.getByLabelText("Fecha del pago"), { target: { value: "2026-11-24" } });
  await userEvent.click(compras.getByRole("button", { name: "Guardar pago" }));
  await vi.waitFor(() => expect(llamadas.find((l) => l.clave === "POST /api/compras/7/pago")?.cuerpo).toEqual({ cuenta_id: 1, fecha: "2026-11-24" }));
});
