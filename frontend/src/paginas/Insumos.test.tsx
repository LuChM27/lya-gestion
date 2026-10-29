import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test } from "vitest";
import { simularApi } from "../pruebas/simular";
import Inicio from "./Inicio";
import Insumo from "./Insumo";
import Insumos from "./Insumos";

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<Inicio usuario="laura" />} />
        <Route path="/insumos" element={<Insumos />} />
        <Route path="/insumos/:id" element={<Insumo />} />
      </Routes>
    </MemoryRouter>,
  );
}

const HILO = {
  id: 5,
  nombre: "Hilo algodón rosa",
  tipo: "hilo",
  unidad: "metros",
  unidad_compra: "cono",
  factor_compra: 400,
  stock_minimo: 100,
  proveedor: null,
  activo: true,
  precio_unitario: 30,
  existencia: 800,
  estado: "ok",
};
const ARGOLLAS = { ...HILO, id: 6, nombre: "Argollas doradas", tipo: "argolla", unidad: "unidades", unidad_compra: null, factor_compra: null };

test("lista vacía invita a agregar el primer insumo", async () => {
  simularApi({ "GET /api/inventario/insumos": { cuerpo: [] } });
  montar("/insumos");
  expect(await screen.findByText("Todavía no hay insumos.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Agregar el primer insumo" }));
  expect(screen.getByLabelText("Unidad")).toBeInTheDocument();
});

test("la lista muestra existencia con su unidad y precio", async () => {
  simularApi({ "GET /api/inventario/insumos": { cuerpo: [HILO] } });
  montar("/insumos");
  expect(await screen.findByText("Hilo algodón rosa")).toBeInTheDocument();
  expect(screen.getByText("800 metros")).toBeInTheDocument();
  expect(screen.getByText("$ 30 por unidad")).toBeInTheDocument();
});

test("crear insumo con conos envía la conversión", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/insumos": { cuerpo: [] },
    "POST /api/inventario/insumos": { estado: 201, cuerpo: HILO },
    "GET /api/inventario/insumos/5": { cuerpo: HILO },
  });
  montar("/insumos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar insumo" }));
  await userEvent.type(screen.getByLabelText("Nombre"), "Hilo algodón rosa");
  await userEvent.type(screen.getByLabelText("Unidad"), "metros");
  await userEvent.click(screen.getByLabelText("Lo compro por paquete, cono o rollo"));
  await userEvent.type(screen.getByLabelText("Unidad de compra"), "cono");
  await userEvent.type(screen.getByLabelText("Cantidad de metros que trae"), "400");
  await userEvent.type(screen.getByLabelText("Precio por unidad (opcional)"), "30");
  await userEvent.click(screen.getByRole("button", { name: "Guardar insumo" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Hilo algodón rosa" })).toBeInTheDocument();
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/insumos")?.cuerpo).toEqual({
    nombre: "Hilo algodón rosa",
    tipo: "hilo",
    unidad: "metros",
    unidad_compra: "cono",
    factor_compra: 400,
    stock_minimo: 0,
    proveedor: null,
    precio_unitario: 30,
  });
});

test("conversión a medias muestra el error del servidor", async () => {
  simularApi({
    "GET /api/inventario/insumos": { cuerpo: [] },
    "POST /api/inventario/insumos": { estado: 422, cuerpo: { detail: "Escribe la unidad de compra y cuánto trae." } },
  });
  montar("/insumos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar insumo" }));
  await userEvent.type(screen.getByLabelText("Nombre"), "Hilo");
  await userEvent.type(screen.getByLabelText("Unidad"), "metros");
  await userEvent.click(screen.getByRole("button", { name: "Guardar insumo" }));
  expect(await screen.findByText("Escribe la unidad de compra y cuánto trae.")).toBeInTheDocument();
});

test("entrada en conos envía en_unidad_compra y el precio pagado", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/insumos/5": { cuerpo: HILO },
    "POST /api/inventario/insumos/5/entradas": { estado: 201, cuerpo: { ...HILO, existencia: 1600 } },
  });
  montar("/insumos/5");
  await userEvent.click(await screen.findByRole("button", { name: "Registrar entrada" }));
  await userEvent.type(screen.getByLabelText("Cantidad"), "2");
  await userEvent.selectOptions(screen.getByLabelText("En"), "cono");
  await userEvent.type(screen.getByLabelText("Precio pagado por cada cono (opcional)"), "12.000");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/insumos/5/entradas")?.cuerpo).toEqual({
    cantidad: 2,
    en_unidad_compra: true,
    precio_unitario: 12000,
  });
});

test("entrada con coma decimal y sin precio", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/insumos/6": { cuerpo: ARGOLLAS },
    "POST /api/inventario/insumos/6/entradas": { estado: 201, cuerpo: ARGOLLAS },
  });
  montar("/insumos/6");
  await userEvent.click(await screen.findByRole("button", { name: "Registrar entrada" }));
  expect(screen.queryByLabelText("En")).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Cantidad"), "12,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/insumos/6/entradas")?.cuerpo).toEqual({
    cantidad: 12.5,
    en_unidad_compra: false,
    precio_unitario: null,
  });
});

test("historial de precios muestra el origen", async () => {
  simularApi({
    "GET /api/inventario/insumos/5": { cuerpo: HILO },
    "GET /api/inventario/insumos/5/precios": {
      cuerpo: [
        { precio_unitario: 30, desde: "2026-10-29T15:00:00Z", origen: "compra" },
        { precio_unitario: 27.5, desde: "2026-10-01T15:00:00Z", origen: "edicion" },
      ],
    },
  });
  montar("/insumos/5");
  await userEvent.click(await screen.findByRole("button", { name: "Ver precios" }));
  expect(await screen.findByText("Compra")).toBeInTheDocument();
  expect(screen.getByText("Editado")).toBeInTheDocument();
  expect(screen.getByText("$ 27,50")).toBeInTheDocument();
});

test("inicio cuenta lo que está por revisar", async () => {
  simularApi({
    "GET /api/inventario/modelos": { cuerpo: [{ estado: "ok" }, { estado: "por_agotarse" }] },
    "GET /api/inventario/insumos": { cuerpo: [{ estado: "bajo_minimo" }, { estado: "por_agotarse" }, { estado: "ok" }] },
  });
  montar("/");
  expect(await screen.findByRole("link", { name: "2 insumos por revisar" })).toHaveAttribute("href", "/insumos");
  expect(screen.getByRole("link", { name: "1 producto por revisar" })).toHaveAttribute("href", "/productos");
});

test("inicio sin pendientes", async () => {
  simularApi({
    "GET /api/inventario/modelos": { cuerpo: [{ estado: "ok" }] },
    "GET /api/inventario/insumos": { cuerpo: [] },
  });
  montar("/");
  expect(await screen.findByText("Todo el inventario está en orden.")).toBeInTheDocument();
});
