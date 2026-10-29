import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Vender from "./Vender";

function Destino() {
  return <p>Detalle {useParams().id}</p>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/vender"]}>
      <Routes>
        <Route path="/vender" element={<Vender />} />
        <Route path="/ventas/:id" element={<Destino />} />
        <Route path="/productos" element={<p>Productos</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const ROSA = { variante_id: 3, modelo_id: 7, nombre: "Bolso balde", color: "Rosa palo", sku: "LA-0003", foto: null, categoria: "crochet", precio: 125000, existencia: 3 };
const NEGRO = { ...ROSA, variante_id: 4, color: "Negro", sku: "LA-0004", existencia: 1 };
const CUENTAS = [
  { id: 1, nombre: "Efectivo" },
  { id: 2, nombre: "Nequi" },
  { id: 3, nombre: "Daviplata" },
];
const VENTA = { id: 12, numero: "0012" };

function api(extra = {}) {
  return simularApi({
    "GET /api/ventas/catalogo": { cuerpo: [ROSA, NEGRO] },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "POST /api/ventas": { estado: 201, cuerpo: VENTA },
    ...extra,
  });
}

const producto = (color: string) => screen.findByRole("button", { name: new RegExp(`^Bolso balde ${color}`) });
const enviado = (llamadas: { clave: string; cuerpo: unknown }[]) => llamadas.find((l) => l.clave === "POST /api/ventas")?.cuerpo;

// El localStorage de Node en las pruebas no es el del navegador: se usa uno en memoria.
beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
    clear: () => datos.clear(),
  });
});

test("tocar un producto lo agrega y Guardar envía la venta", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("Detalle 12")).toBeInTheDocument();
  expect(enviado(llamadas)).toEqual({
    canal: "presencial",
    cuenta_id: 1,
    descuento: 0,
    fecha: null,
    nota: null,
    items: [{ variante_id: 3, cantidad: 2 }],
  });
});

test("no suma más de lo que hay en vitrina", async () => {
  api();
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.click(await producto("Negro"));
  expect(screen.getByText("Solo hay 1 en vitrina.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Guardar venta \$ 125\.000/ })).toBeInTheDocument();
});

test("recuerda canal y cuenta del último uso", async () => {
  api();
  const { unmount } = montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: "Feria" }));
  await userEvent.click(screen.getByRole("button", { name: "Nequi" }));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  unmount();
  montar();
  await producto("Rosa palo");
  expect(screen.getByRole("button", { name: "Feria" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("button", { name: "Nequi" })).toHaveAttribute("aria-pressed", "true");
});

test("descuento mayor que el subtotal no se envía", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.type(screen.getByLabelText("Descuento (opcional)"), "200.000");
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("El descuento no puede ser mayor que el subtotal.")).toBeInTheDocument();
  expect(enviado(llamadas)).toBeUndefined();
});

test("error del servidor se muestra", async () => {
  api({ "POST /api/ventas": { estado: 422, cuerpo: { detail: "Solo hay 0 de Bolso balde Negro." } } });
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("Solo hay 0 de Bolso balde Negro.")).toBeInTheDocument();
});

test("sin productos en vitrina", async () => {
  api({ "GET /api/ventas/catalogo": { cuerpo: [] } });
  montar();
  expect(await screen.findByText("No hay productos en vitrina.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a productos" })).toHaveAttribute("href", "/productos");
});

test("fecha de otro día se envía", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-28" } });
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  expect(enviado(llamadas)).toMatchObject({ fecha: "2026-10-28" });
});

test("buscar filtra por color sin tildes", async () => {
  api();
  montar();
  await producto("Rosa palo");
  await userEvent.type(screen.getByLabelText("Buscar"), "rosá");
  expect(screen.queryByRole("button", { name: /^Bolso balde Negro/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Bolso balde Rosa palo/ })).toBeInTheDocument();
});
