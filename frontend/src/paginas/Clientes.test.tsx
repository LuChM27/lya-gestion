import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Clientes from "./Clientes";

function Venta() {
  return <p>Venta {useParams().id}</p>;
}

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<Clientes />} />
        <Route path="/ventas/:id" element={<Venta />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

const VALENTINA = { id: 5, nombre: "Valentina Ríos", whatsapp: "573004567812", instagram: "@valen.rios", total_comprado: 375000, activo: true };
const SOFIA = { id: 6, nombre: "Sofía Gómez", whatsapp: "573152209087", instagram: null, total_comprado: 180000, activo: true };
const FICHA = {
  ...VALENTINA,
  direccion: "Cra. 43 #12-50",
  ciudad: "Medellín",
  correo: null,
  cedula: null,
  notas: null,
  enlace_whatsapp: "https://wa.me/573004567812",
  creado: "2026-10-12T15:00:00Z",
  compras: 4,
  por_cobrar: 0,
  promedio: 93750,
  canal_frecuente: "instagram",
  ultima_compra: "2026-11-21T15:00:00Z",
  historial: [{ id: 31, numero: "0031", fecha: "2026-11-21T15:00:00Z", productos: "Bolso balde · Rosa palo", total: 125000, estado: "entregado" }],
};

test("lista las clientas con su total", async () => {
  simularApi({ "GET /api/clientes": { cuerpo: [VALENTINA, SOFIA] } });
  montar("/clientes");
  const lista = within(await screen.findByRole("list", { name: "Clientas" }));
  expect(lista.getByText("Valentina Ríos")).toBeInTheDocument();
  expect(lista.getByText("$ 375.000")).toBeInTheDocument();
  expect(lista.getByText("300 456 7812")).toBeInTheDocument();
});

test("busca al escribir", async () => {
  const llamadas = simularApi({
    "GET /api/clientes": { cuerpo: [VALENTINA, SOFIA] },
    "GET /api/clientes?buscar=sofi": { cuerpo: [SOFIA] },
  });
  montar("/clientes");
  await screen.findByText("Valentina Ríos");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sofi" } });
  expect(await screen.findByText("Sofía Gómez")).toBeInTheDocument();
  await vi.waitFor(() => expect(screen.queryByText("Valentina Ríos")).not.toBeInTheDocument());
  expect(llamadas.map((l) => l.clave)).toContain("GET /api/clientes?buscar=sofi");
});

test("abre la ficha", async () => {
  simularApi({ "GET /api/clientes": { cuerpo: [VALENTINA] }, "GET /api/clientes/5": { cuerpo: FICHA } });
  montar("/clientes/5");
  expect(await screen.findByRole("heading", { name: "Valentina Ríos" })).toBeInTheDocument();
  const whatsapp = screen.getByRole("link", { name: /Escribir por WhatsApp/ });
  expect(whatsapp).toHaveAttribute("href", "https://wa.me/573004567812");
  expect(whatsapp).toHaveAttribute("target", "_blank");
  const total = screen.getByText("Total comprado").parentElement!;
  expect(within(total).getByText("$ 375.000")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "N.º 0031" })).toHaveAttribute("href", "/ventas/31");
});

test("muestra guiones en los datos vacíos", async () => {
  simularApi({ "GET /api/clientes": { cuerpo: [VALENTINA] }, "GET /api/clientes/5": { cuerpo: FICHA } });
  montar("/clientes/5");
  await screen.findByRole("heading", { name: "Valentina Ríos" });
  for (const dato of ["Correo", "Cédula", "Notas"]) {
    expect(within(screen.getByText(dato).parentElement!).getByText("—")).toBeInTheDocument();
  }
});

test("crea una clienta y la abre", async () => {
  const nueva = { ...FICHA, id: 9, nombre: "Camila Mejía", historial: [] };
  const llamadas = simularApi({
    "GET /api/clientes": { cuerpo: [] },
    "POST /api/clientes": { estado: 201, cuerpo: nueva },
    "GET /api/clientes/9": { cuerpo: nueva },
  });
  montar("/clientes");
  await userEvent.click((await screen.findAllByRole("button", { name: "Nueva clienta" }))[0]);
  await userEvent.type(screen.getByLabelText("Nombre"), "Camila Mejía");
  await userEvent.type(screen.getByLabelText("WhatsApp"), "312 778 0011");
  await userEvent.click(screen.getByRole("button", { name: "Guardar clienta" }));
  expect(await screen.findByRole("heading", { name: "Camila Mejía" })).toBeInTheDocument();
  const post = llamadas.find((l) => l.clave === "POST /api/clientes")!;
  expect(post.cuerpo).toMatchObject({ nombre: "Camila Mejía", whatsapp: "312 778 0011" });
});

test("muestra el aviso de WhatsApp repetido", async () => {
  simularApi({
    "GET /api/clientes": { cuerpo: [VALENTINA] },
    "POST /api/clientes": { estado: 409, cuerpo: { detail: "Ya tienes a Valentina Ríos con ese WhatsApp." } },
  });
  montar("/clientes");
  await userEvent.click((await screen.findAllByRole("button", { name: "Nueva clienta" }))[0]);
  await userEvent.type(screen.getByLabelText("Nombre"), "Otra");
  await userEvent.type(screen.getByLabelText("WhatsApp"), "3004567812");
  await userEvent.click(screen.getByRole("button", { name: "Guardar clienta" }));
  expect(await screen.findByText("Ya tienes a Valentina Ríos con ese WhatsApp.")).toBeInTheDocument();
});

test("edita y archiva", async () => {
  const llamadas = simularApi({
    "GET /api/clientes": { cuerpo: [VALENTINA] },
    "GET /api/clientes/5": { cuerpo: FICHA },
    "DELETE /api/clientes/5": { estado: 204 },
  });
  montar("/clientes/5");
  await userEvent.click(await screen.findByRole("button", { name: "Editar clienta" }));
  expect(screen.getByLabelText("Nombre")).toHaveValue("Valentina Ríos");
  expect(screen.getByLabelText("Ciudad")).toHaveValue("Medellín");
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await userEvent.click(screen.getByRole("button", { name: "Archivar clienta" }));
  await userEvent.click(screen.getByRole("button", { name: "Archivar" }));
  await vi.waitFor(() => expect(llamadas.map((l) => l.clave)).toContain("DELETE /api/clientes/5"));
  expect(await screen.findByText("Elige una clienta para ver su ficha.")).toBeInTheDocument();
});

test("lista vacía", async () => {
  simularApi({ "GET /api/clientes": { cuerpo: [] } });
  montar("/clientes");
  expect(await screen.findByText("Todavía no tienes clientas.")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Nueva clienta" }).length).toBe(2);
});
