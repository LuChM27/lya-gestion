import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Gasto from "./Gasto";

// El localStorage de Node en las pruebas no es el del navegador: se usa uno en memoria.
beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

function montar(ruta = "/cuentas/gasto") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/cuentas/gasto" element={<Gasto />} />
        <Route path="/cuentas" element={<p>Mis cuentas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const CUENTAS = [
  { id: 1, nombre: "Efectivo" },
  { id: 2, nombre: "Nequi" },
];
const CATEGORIAS = [
  { id: 4, nombre: "Publicidad", tipo: "gasto", activa: true, protegida: false },
  { id: 8, nombre: "Stand de feria", tipo: "gasto", activa: true, protegida: false },
];

function api(extra = {}) {
  return simularApi({
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "GET /api/categorias?tipo=gasto": { cuerpo: CATEGORIAS },
    "POST /api/movimientos": { estado: 201, cuerpo: { id: 1 } },
    ...extra,
  });
}

const enviado = (llamadas: { clave: string; cuerpo: unknown }[]) => llamadas.find((l) => l.clave === "POST /api/movimientos")?.cuerpo;

test("lee el monto con puntos de miles", async () => {
  const llamadas = api();
  montar();
  fireEvent.change(await screen.findByLabelText("¿Cuánto?"), { target: { value: "150.000" } });
  const franja = within(screen.getByRole("region", { name: "Total" }));
  expect(franja.getByText("$ 150.000")).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Stand de feria" }));
  await userEvent.click(franja.getByRole("button", { name: "Guardar gasto" }));
  await screen.findByText("Mis cuentas");
  expect(enviado(llamadas)).toMatchObject({ monto: 150000 });
});

test("elige categoría y cuenta y guarda", async () => {
  const llamadas = api();
  montar();
  fireEvent.change(await screen.findByLabelText("¿Cuánto?"), { target: { value: "80000" } });
  await userEvent.click(await screen.findByRole("button", { name: "Publicidad" }));
  await userEvent.click(screen.getByRole("button", { name: "Nequi" }));
  expect(screen.getByText("Publicidad · Nequi")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(await screen.findByText("Mis cuentas")).toBeInTheDocument();
  expect(enviado(llamadas)).toEqual({ tipo: "gasto", monto: 80000, categoria_id: 4, cuenta_id: 2, cuenta_destino_id: null, fecha: null, nota: null, gasto_fijo_id: null });
});

test("recuerda la última cuenta", async () => {
  api();
  const { unmount } = montar();
  fireEvent.change(await screen.findByLabelText("¿Cuánto?"), { target: { value: "1000" } });
  await userEvent.click(await screen.findByRole("button", { name: "Publicidad" }));
  await userEvent.click(screen.getByRole("button", { name: "Nequi" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  await screen.findByText("Mis cuentas");
  unmount();
  montar();
  expect(await screen.findByRole("button", { name: "Nequi" })).toHaveAttribute("aria-pressed", "true");
});

test("sin monto no guarda", async () => {
  api();
  montar();
  await screen.findByRole("button", { name: "Publicidad" });
  expect(screen.getByRole("button", { name: "Escribe el monto" })).toBeDisabled();
});

test("agregar nota", async () => {
  const llamadas = api();
  montar();
  fireEvent.change(await screen.findByLabelText("¿Cuánto?"), { target: { value: "5000" } });
  await userEvent.click(await screen.findByRole("button", { name: "Publicidad" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar nota" }));
  await userEvent.type(screen.getByLabelText("Nota"), "Volantes");
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  await screen.findByText("Mis cuentas");
  expect(enviado(llamadas)).toMatchObject({ nota: "Volantes" });
});

test("sin categoría avisa", async () => {
  api();
  montar();
  fireEvent.change(await screen.findByLabelText("¿Cuánto?"), { target: { value: "5000" } });
  await screen.findByRole("button", { name: "Publicidad" });
  await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));
  expect(screen.getByText("Elige en qué se fue el dinero.")).toBeInTheDocument();
});
