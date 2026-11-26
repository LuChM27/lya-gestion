import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Compra from "./Compra";
import Compras from "./Compras";
import NuevaCompra from "./NuevaCompra";

beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

function Destino() {
  return <p>{`Compra guardada ${useParams().id}`}</p>;
}

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/compras" element={<Compras />} />
        <Route path="/compras/nueva" element={<NuevaCompra />} />
        <Route path="/compras/:id" element={ruta === "/compras/nueva" ? <Destino /> : <Compra />} />
      </Routes>
    </MemoryRouter>,
  );
}

const HILO = { id: 3, nombre: "Hilo algodón rosa palo", tipo: "hilo", unidad: "metros", unidad_compra: "conos", factor_compra: 400, stock_minimo: 0, proveedor: null, activo: true, precio_unitario: 45, existencia: 0, estado: "ok" };
const ARGOLLAS = { ...HILO, id: 4, nombre: "Argollas doradas", tipo: "argolla", unidad: "unidades", unidad_compra: null, factor_compra: null, precio_unitario: 1500 };
const CUENTAS = [
  { id: 1, nombre: "Efectivo" },
  { id: 2, nombre: "Nequi" },
];
const COMPRA = {
  id: 7,
  numero: "0007",
  fecha: "2026-11-23T15:00:00Z",
  proveedor: "Hilos La 14",
  total: 66000,
  estado: "activa",
  nota: null,
  cuenta: null,
  pagada_el: null,
  items: [{ insumo_id: 3, insumo: "Hilo algodón rosa palo", cantidad: 800, unidad: "metros", precio_unitario: 45, subtotal: 36000 }],
};

function api(extra = {}) {
  return simularApi({
    "GET /api/inventario/insumos": { cuerpo: [HILO, ARGOLLAS] },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "GET /api/compras/proveedores": { cuerpo: ["Hilos La 14", "Murano Express"] },
    "POST /api/compras": { estado: 201, cuerpo: { ...COMPRA, id: 9 } },
    ...extra,
  });
}

async function agregar(nombre: string) {
  await userEvent.click(screen.getByRole("button", { name: "Agregar insumo" }));
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(nombre) }));
}

const enviado = (llamadas: { clave: string; cuerpo: unknown }[]) => llamadas.find((l) => l.clave === "POST /api/compras")?.cuerpo;

test("arma una compra con dos insumos", async () => {
  const llamadas = api();
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Nequi" });
  fireEvent.change(screen.getByLabelText("Proveedor"), { target: { value: "Hilos La 14" } });
  await agregar("Hilo algodón");
  const hilo = within(screen.getByRole("group", { name: "Hilo algodón rosa palo" }));
  expect(hilo.getByLabelText("Precio de Hilo algodón rosa palo")).toHaveValue("$ 18.000");
  fireEvent.change(hilo.getByLabelText("Cantidad de Hilo algodón rosa palo"), { target: { value: "2" } });
  await userEvent.click(hilo.getByRole("button", { name: "metros" }));
  expect(hilo.getByLabelText("Precio de Hilo algodón rosa palo")).toHaveValue("$ 45");
  expect(hilo.getByLabelText("Cantidad de Hilo algodón rosa palo")).toHaveValue("800");
  await userEvent.click(hilo.getByRole("button", { name: "conos" }));
  expect(hilo.getByLabelText("Cantidad de Hilo algodón rosa palo")).toHaveValue("2");
  await agregar("Argollas");
  const argollas = within(screen.getByRole("group", { name: "Argollas doradas" }));
  fireEvent.change(argollas.getByLabelText("Cantidad de Argollas doradas"), { target: { value: "20" } });
  expect(screen.getByText("$ 66.000")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Nequi" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar compra" }));
  expect(await screen.findByText("Compra guardada 9")).toBeInTheDocument();
  expect(enviado(llamadas)).toEqual({
    proveedor: "Hilos La 14",
    fecha: null,
    cuenta_id: 2,
    nota: null,
    items: [
      { insumo_id: 3, cantidad: 2, en_unidad_compra: true, precio_unitario: 18000 },
      { insumo_id: 4, cantidad: 20, en_unidad_compra: false, precio_unitario: 1500 },
    ],
  });
});

test("después deja la compra sin pagar", async () => {
  const llamadas = api();
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Después" });
  await agregar("Argollas");
  fireEvent.change(screen.getByLabelText("Cantidad de Argollas doradas"), { target: { value: "5" } });
  await userEvent.click(screen.getByRole("button", { name: "Después" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar compra" }));
  await screen.findByText("Compra guardada 9");
  expect(enviado(llamadas)).toMatchObject({ cuenta_id: null });
});

test("quitar un insumo", async () => {
  api();
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Nequi" });
  await agregar("Argollas");
  fireEvent.change(screen.getByLabelText("Cantidad de Argollas doradas"), { target: { value: "2" } });
  expect(within(screen.getByRole("group", { name: "Argollas doradas" })).getByText("$ 3.000")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Quitar Argollas doradas" }));
  expect(screen.queryByRole("group", { name: "Argollas doradas" })).not.toBeInTheDocument();
  expect(screen.getByText("Agrega los insumos que compraste.")).toBeInTheDocument();
});

test("proveedor sugerido", async () => {
  api();
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Nequi" });
  await vi.waitFor(() => expect([...document.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toEqual(["Hilos La 14", "Murano Express"]));
});

test("sin insumos no guarda", async () => {
  const llamadas = api();
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Nequi" });
  await userEvent.click(screen.getByRole("button", { name: "Guardar compra" }));
  expect(screen.getByText("Agrega al menos un insumo.")).toBeInTheDocument();
  expect(enviado(llamadas)).toBeUndefined();
});

test("detalle con pago y anulación", async () => {
  const llamadas = api({
    "GET /api/compras/7": { cuerpo: COMPRA },
    "POST /api/compras/7/pago": { cuerpo: { ...COMPRA, cuenta: { id: 1, nombre: "Efectivo" }, pagada_el: "2026-11-25T15:00:00Z" } },
    "POST /api/compras/7/anular": { cuerpo: { ...COMPRA, estado: "anulada" } },
  });
  montar("/compras/7");
  expect(await screen.findByRole("heading", { name: "Compra N.º 0007" })).toBeInTheDocument();
  expect(screen.getByText("Sin pagar")).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Efectivo" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar pago" }));
  expect(await screen.findByText(/Pagada con Efectivo/)).toBeInTheDocument();
  expect(llamadas.find((l) => l.clave === "POST /api/compras/7/pago")?.cuerpo).toEqual({ cuenta_id: 1, fecha: null });
  await userEvent.click(screen.getByRole("button", { name: "Anular compra" }));
  expect(screen.getByText("¿Anular la compra N.º 0007? Los insumos salen del inventario y el pago se borra.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Anular" }));
  expect(await screen.findByText("Anulada")).toBeInTheDocument();
});

test("lista de compras", async () => {
  api({ "GET /api/compras": { cuerpo: [COMPRA, { ...COMPRA, id: 6, numero: "0006", proveedor: "Murano Express", cuenta: { id: 2, nombre: "Nequi" } }] } });
  montar("/compras");
  const sinPagar = (await screen.findByText(/N\.º 0007/)).closest("a")!;
  expect(sinPagar).toHaveAttribute("href", "/compras/7");
  expect(within(sinPagar).getByText("Sin pagar")).toBeInTheDocument();
  expect(within(screen.getByText(/N\.º 0006/).closest("a")!).getByText("Nequi")).toBeInTheDocument();
});

test("el subtotal coincide con lo que guarda el servidor", async () => {
  const siete = { ...HILO, id: 5, nombre: "Cuentas sueltas", unidad: "unidades", unidad_compra: "bolsas", factor_compra: 7, precio_unitario: null };
  api({ "GET /api/inventario/insumos": { cuerpo: [siete] } });
  montar("/compras/nueva");
  await screen.findByRole("button", { name: "Nequi" });
  await agregar("Cuentas sueltas");
  const fila = within(screen.getByRole("group", { name: "Cuentas sueltas" }));
  fireEvent.change(fila.getByLabelText("Cantidad de Cuentas sueltas"), { target: { value: "1000" } });
  fireEvent.change(fila.getByLabelText("Precio de Cuentas sueltas"), { target: { value: "1000" } });
  // 7.000 unidades × $ 142,86 (1.000 ÷ 7 redondeado a centavos), como el servidor.
  expect(fila.getByText("$ 1.000.020")).toBeInTheDocument();
});

test("pago de otro día y aviso si otro equipo ya pagó", async () => {
  const pagada = { ...COMPRA, cuenta: { id: 2, nombre: "Nequi" }, pagada_el: "2026-11-24T15:00:00Z" };
  api({
    "GET /api/compras/7": { cuerpo: COMPRA },
  });
  montar("/compras/7");
  await userEvent.click(await screen.findByRole("button", { name: "Efectivo" }));
  fireEvent.change(screen.getByLabelText("Fecha del pago"), { target: { value: "2026-11-24" } });
  const llamadas = simularApi({
    "GET /api/compras/7": { cuerpo: pagada },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "POST /api/compras/7/pago": { estado: 409, cuerpo: { detail: "Esta compra ya está pagada." } },
  });
  await userEvent.click(screen.getByRole("button", { name: "Guardar pago" }));
  expect(await screen.findByText(/Pagada con Nequi/)).toBeInTheDocument();
  expect(screen.getByText("Esta compra ya está pagada.")).toBeInTheDocument();
  expect(llamadas.find((l) => l.clave === "POST /api/compras/7/pago")?.cuerpo).toEqual({ cuenta_id: 1, fecha: "2026-11-24" });
});
