import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import { simularApi } from "../pruebas/simular";
import Inicio from "./Inicio";

function montar() {
  return render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );
}

const DATOS = {
  ventas_hoy: { total: 240000, cantidad: 1, por_canal: { instagram: 1 } },
  ventas_mes: { total: 2480000, cantidad: 18, mes: "octubre" },
  vitrina: { piezas: 46, valor: 3920000 },
  avisos: [
    { tipo: "insumo", id: 5, nombre: "Hilo algodón rosa palo", detalle: "Quedan 2 conos · mínimo 2", estado: "por_agotarse" },
    { tipo: "producto", id: 7, nombre: "Bolso balde · Negro", detalle: "Quedan 1 · mínimo 2", estado: "bajo_minimo" },
  ],
};

test("inicio muestra las cifras del día, del mes y de la vitrina", async () => {
  simularApi({ "GET /api/inicio": { cuerpo: DATOS } });
  montar();
  expect(await screen.findByRole("heading", { level: 1, name: "¡Hola de nuevo!" })).toBeInTheDocument();
  expect(screen.getByText("Vendiste hoy")).toBeInTheDocument();
  expect(screen.getByText("$ 240.000")).toBeInTheDocument();
  expect(screen.getByText("1 venta · 1 por Instagram")).toBeInTheDocument();
  expect(screen.getByText("Ventas de octubre")).toBeInTheDocument();
  expect(screen.getByText("$ 2.480.000")).toBeInTheDocument();
  expect(screen.getByText("46 piezas")).toBeInTheDocument();
  expect(screen.getByText("$ 3.920.000 a precio de venta")).toBeInTheDocument();
});

test("los avisos enlazan a su ficha", async () => {
  simularApi({ "GET /api/inicio": { cuerpo: DATOS } });
  montar();
  expect(await screen.findByRole("heading", { name: "Para no olvidar" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Hilo algodón rosa palo/ })).toHaveAttribute("href", "/insumos/5");
  expect(screen.getByRole("link", { name: /Bolso balde · Negro/ })).toHaveAttribute("href", "/productos/7");
  expect(screen.getByText("Quedan 2 conos · mínimo 2")).toBeInTheDocument();
});

test("el primer día muestra ceros y todo en orden", async () => {
  simularApi({
    "GET /api/inicio": {
      cuerpo: {
        ventas_hoy: { total: 0, cantidad: 0, por_canal: {} },
        ventas_mes: { total: 0, cantidad: 0, mes: "octubre" },
        vitrina: { piezas: 0, valor: 0 },
        avisos: [],
      },
    },
  });
  montar();
  expect(await screen.findByText("Todo el inventario está en orden.")).toBeInTheDocument();
  expect(screen.getAllByText("$ 0").length).toBeGreaterThan(0);
  expect(screen.getByText("0 piezas")).toBeInTheDocument();
  expect(screen.getByText("Aún no hay ventas hoy")).toBeInTheDocument();
});

test("varias ventas por canal", async () => {
  simularApi({ "GET /api/inicio": { cuerpo: { ...DATOS, ventas_hoy: { total: 220000, cantidad: 3, por_canal: { instagram: 2, presencial: 1 } } } } });
  montar();
  expect(await screen.findByText("3 ventas · 2 por Instagram, 1 en persona")).toBeInTheDocument();
});
