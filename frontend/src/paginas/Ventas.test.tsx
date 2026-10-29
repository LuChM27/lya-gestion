import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test } from "vitest";
import { simularApi } from "../pruebas/simular";
import { hoyBogota } from "../ventas";
import Venta from "./Venta";
import Ventas from "./Ventas";

type Entrada = string | { pathname: string; state: unknown };

function montar(ruta: Entrada) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/ventas/:id" element={<Venta />} />
      </Routes>
    </MemoryRouter>,
  );
}

const VENTA = {
  id: 12,
  numero: "0012",
  fecha: "2026-10-29T20:15:00Z",
  canal: "instagram",
  estado: "entregado",
  cliente: "Cliente de mostrador",
  cuenta: { id: 2, nombre: "Nequi" },
  items: [{ variante_id: 3, modelo: "Bolso balde", color: "Rosa palo", cantidad: 2, precio_unitario: 125000, subtotal: 250000 }],
  subtotal: 250000,
  descuento: 10000,
  total: 240000,
  comprobante: "/api/pedidos/12/comprobante.pdf?v=20261029201500123456",
};
const OTRA = { ...VENTA, id: 13, numero: "0013", total: 125000, subtotal: 125000, descuento: 0, comprobante: "/api/pedidos/13/comprobante.pdf?v=1" };
const ANULADA = { ...VENTA, id: 14, numero: "0014", estado: "cancelado", cuenta: null, comprobante: "/api/pedidos/14/comprobante.pdf?v=2" };
const hoy = hoyBogota();

test("lista del día con total y anuladas tachadas", async () => {
  simularApi({ [`GET /api/ventas?dia=${hoy}`]: { cuerpo: { dia: hoy, ventas: [ANULADA, OTRA, VENTA], total: 365000, cantidad: 2 } } });
  montar("/ventas");
  expect(await screen.findByText("2 ventas · $ 365.000")).toBeInTheDocument();
  expect(screen.getByText("Anulada")).toBeInTheDocument();
  expect(screen.getAllByText("Bolso balde · Rosa palo ×2")).toHaveLength(3);
  expect(screen.getByRole("link", { name: /N\.º 0013/ })).toHaveAttribute("href", "/ventas/13");
});

test("cambiar el día pide ese día", async () => {
  const llamadas = simularApi({
    [`GET /api/ventas?dia=${hoy}`]: { cuerpo: { dia: hoy, ventas: [], total: 0, cantidad: 0 } },
    "GET /api/ventas?dia=2026-10-28": { cuerpo: { dia: "2026-10-28", ventas: [VENTA], total: 240000, cantidad: 1 } },
  });
  montar("/ventas");
  expect(await screen.findByText("No hay ventas este día.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2026-10-28" } });
  expect(await screen.findByText("1 venta · $ 240.000")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave === "GET /api/ventas?dia=2026-10-28")).toBe(true);
});

test("detalle muestra el comprobante con su dirección", async () => {
  simularApi({ "GET /api/ventas/12": { cuerpo: VENTA } });
  montar("/ventas/12");
  expect(await screen.findByRole("link", { name: "Ver comprobante PDF" })).toHaveAttribute("href", VENTA.comprobante);
  expect(screen.getByText("Venta N.º 0012")).toBeInTheDocument();
  expect(screen.getByText("$ 240.000")).toBeInTheDocument();
  expect(screen.queryByText("Venta guardada")).not.toBeInTheDocument();
});

test("anular pide confirmación y actualiza", async () => {
  const llamadas = simularApi({
    "GET /api/ventas/12": { cuerpo: VENTA },
    "POST /api/ventas/12/anular": { cuerpo: { ...VENTA, estado: "cancelado", cuenta: null, comprobante: "/api/pedidos/12/comprobante.pdf?v=2" } },
  });
  montar("/ventas/12");
  await userEvent.click(await screen.findByRole("button", { name: "Anular venta" }));
  expect(
    screen.getByText("¿Anular la venta N.º 0012? Las unidades vuelven a la vitrina y se quita el ingreso de Nequi."),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Anular" }));
  expect(await screen.findByText("Anulada")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave === "POST /api/ventas/12/anular")).toBe(true);
  expect(screen.queryByRole("button", { name: "Anular venta" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver comprobante PDF" })).toHaveAttribute("href", "/api/pedidos/12/comprobante.pdf?v=2");
});

test("confirmación con Ver comprobante PDF y Otra venta", async () => {
  simularApi({ "GET /api/ventas/12": { cuerpo: VENTA } });
  montar({ pathname: "/ventas/12", state: { guardada: true } });
  const aviso = await screen.findByRole("status");
  expect(aviso).toHaveTextContent("¡Venta guardada!");
  expect(aviso).toHaveTextContent("$ 240.000 entraron a Nequi y el inventario ya se descontó.");
  expect(within(aviso).getByRole("link", { name: "Ver comprobante PDF" })).toHaveAttribute("href", VENTA.comprobante);
  expect(within(aviso).getByRole("link", { name: "Otra venta" })).toHaveAttribute("href", "/vender");
});

test("doble toque en Anular envía una sola anulación", async () => {
  const llamadas = simularApi({
    "GET /api/ventas/12": { cuerpo: VENTA },
    "POST /api/ventas/12/anular": { demoraMs: 50, cuerpo: { ...VENTA, estado: "cancelado", cuenta: null } },
  });
  montar("/ventas/12");
  await userEvent.click(await screen.findByRole("button", { name: "Anular venta" }));
  const anular = screen.getByRole("button", { name: "Anular" });
  await userEvent.dblClick(anular);
  expect(await screen.findByText("Anulada")).toBeInTheDocument();
  expect(llamadas.filter((l) => l.clave === "POST /api/ventas/12/anular")).toHaveLength(1);
});

test("borrar el día vuelve a hoy", async () => {
  simularApi({
    [`GET /api/ventas?dia=${hoy}`]: { cuerpo: { dia: hoy, ventas: [VENTA], total: 240000, cantidad: 1 } },
    "GET /api/ventas?dia=2026-10-28": { cuerpo: { dia: "2026-10-28", ventas: [], total: 0, cantidad: 0 } },
  });
  montar("/ventas");
  await screen.findByText("1 venta · $ 240.000");
  fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2026-10-28" } });
  await screen.findByText("No hay ventas este día.");
  fireEvent.change(screen.getByLabelText("Día"), { target: { value: "" } });
  expect(await screen.findByText("1 venta · $ 240.000")).toBeInTheDocument();
  expect(screen.getByLabelText("Día")).toHaveValue(hoy);
});
