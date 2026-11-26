import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Categorias from "./Categorias";

afterEach(() => vi.unstubAllGlobals());

const CATEGORIAS = [
  { id: 1, nombre: "Ventas", tipo: "ingreso", activa: true, protegida: true },
  { id: 11, nombre: "Otros ingresos", tipo: "ingreso", activa: true, protegida: false },
  { id: 2, nombre: "Insumos", tipo: "gasto", activa: true, protegida: true },
  { id: 4, nombre: "Publicidad", tipo: "gasto", activa: true, protegida: false },
  { id: 10, nombre: "Retiro personal", tipo: "retiro", activa: true, protegida: true },
];

test("lista por tipo, crea, renombra y archiva", async () => {
  const llamadas = simularApi({
    "GET /api/categorias": { cuerpo: CATEGORIAS },
    "POST /api/categorias": { estado: 201, cuerpo: { id: 20, nombre: "Clases", tipo: "gasto", activa: true, protegida: false } },
    "PUT /api/categorias/4": { cuerpo: { ...CATEGORIAS[3], nombre: "Anuncios" } },
    "DELETE /api/categorias/4": { estado: 204 },
  });
  render(
    <MemoryRouter>
      <Categorias />
    </MemoryRouter>,
  );
  const gastos = within(await screen.findByRole("region", { name: "Gastos" }));
  expect(gastos.getByText("Insumos")).toBeInTheDocument();
  expect(gastos.queryByRole("button", { name: "Archivar Insumos" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Ingresos" })).getByText("Otros ingresos")).toBeInTheDocument();
  expect(screen.queryByText("Retiro personal")).not.toBeInTheDocument();

  await userEvent.type(gastos.getByLabelText("Nueva categoría de gasto"), "Clases");
  await userEvent.click(gastos.getByRole("button", { name: "Agregar" }));
  await vi.waitFor(() => expect(llamadas.find((l) => l.clave === "POST /api/categorias")?.cuerpo).toEqual({ nombre: "Clases", tipo: "gasto" }));

  await userEvent.click(gastos.getByRole("button", { name: "Renombrar Publicidad" }));
  const nombre = gastos.getByLabelText("Nuevo nombre de Publicidad");
  await userEvent.clear(nombre);
  await userEvent.type(nombre, "Anuncios");
  await userEvent.click(gastos.getByRole("button", { name: "Guardar" }));
  await vi.waitFor(() => expect(llamadas.find((l) => l.clave === "PUT /api/categorias/4")?.cuerpo).toEqual({ nombre: "Anuncios" }));

  await userEvent.click(gastos.getByRole("button", { name: "Archivar Publicidad" }));
  await userEvent.click(gastos.getByRole("button", { name: "Archivar" }));
  await vi.waitFor(() => expect(llamadas.map((l) => l.clave)).toContain("DELETE /api/categorias/4"));
});
