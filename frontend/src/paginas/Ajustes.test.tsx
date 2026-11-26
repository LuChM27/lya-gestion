import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Ajustes from "./Ajustes";

afterEach(() => vi.unstubAllGlobals());

function montar() {
  return render(
    <MemoryRouter>
      <Ajustes />
    </MemoryRouter>,
  );
}

const DIARIO = { nombre: "lya-2026-11-24-210000.zip", fecha: "2026-11-25T02:00:00Z", motivo: "diario", tamano: 2_500_000 };
const MANUAL = { nombre: "lya-2026-11-25-100000-manual.zip", fecha: "2026-11-25T15:00:00Z", motivo: "manual", tamano: 900_000 };
const DATOS = { carpeta: "~/LyA-Respaldos", atrasado: false, respaldos: [DIARIO] };

test("muestra el último respaldo, la carpeta y la lista", async () => {
  simularApi({ "GET /api/respaldos": { cuerpo: DATOS } });
  montar();
  expect(await screen.findByText("Tus datos están respaldados")).toBeInTheDocument();
  expect(screen.getByText("El último es del 24/11/2026 · 9:00 p. m.")).toBeInTheDocument();
  expect(screen.getByText("~/LyA-Respaldos")).toBeInTheDocument();
  expect(screen.getByText("Automático · 2,4 MB")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Descargar" })).toHaveAttribute("href", `/api/respaldos/${DIARIO.nombre}`);
});

test("avisa si no hay respaldos o están atrasados", async () => {
  simularApi({ "GET /api/respaldos": { cuerpo: { ...DATOS, atrasado: true, respaldos: [] } } });
  montar();
  expect(await screen.findByText("Todavía no hay ningún respaldo")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Respaldos guardados" })).not.toBeInTheDocument();
});

test("respaldar ahora guarda uno y recarga la lista", async () => {
  const llamadas = simularApi({
    "GET /api/respaldos": { cuerpo: DATOS },
    "POST /api/respaldos": { estado: 201, cuerpo: MANUAL },
  });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Respaldar ahora" }));
  expect(await screen.findByText("Listo: guardaste un respaldo del 25/11/2026 · 10:00 a. m.")).toBeInTheDocument();
  expect(llamadas.filter((l) => l.clave === "POST /api/respaldos")).toHaveLength(1);
  expect(llamadas.filter((l) => l.clave === "GET /api/respaldos")).toHaveLength(2);
});

test("restaurar pide confirmación antes", async () => {
  const llamadas = simularApi({
    "GET /api/respaldos": { cuerpo: DATOS },
    [`POST /api/respaldos/${DIARIO.nombre}/restaurar`]: { cuerpo: { ...MANUAL, motivo: "antes-de-restaurar" } },
  });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Restaurar" }));
  expect(screen.getByText(/¿Volver tus datos y fotos al 24\/11\/2026 · 9:00 p\. m\.\?/)).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.endsWith("/restaurar"))).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Sí, restaurar" }));
  expect(await screen.findByText(/Listo: tus datos volvieron al 24\/11\/2026/)).toBeInTheDocument();
  await waitFor(() => expect(llamadas.filter((l) => l.clave.endsWith("/restaurar"))).toHaveLength(1));
});

test("muestra el error si el respaldo está dañado", async () => {
  simularApi({
    "GET /api/respaldos": { cuerpo: DATOS },
    [`POST /api/respaldos/${DIARIO.nombre}/restaurar`]: { estado: 422, cuerpo: { detail: "Ese respaldo está dañado y no se puede restaurar." } },
  });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Restaurar" }));
  await userEvent.click(screen.getByRole("button", { name: "Sí, restaurar" }));
  expect(await screen.findByText("Ese respaldo está dañado y no se puede restaurar.")).toBeInTheDocument();
});

test("con muchos respaldos muestra 10 y deja ver todos", async () => {
  const muchos = Array.from({ length: 12 }, (_, i) => ({ ...DIARIO, nombre: `lya-2026-11-${String(i + 1).padStart(2, "0")}-210000.zip` }));
  simularApi({ "GET /api/respaldos": { cuerpo: { ...DATOS, respaldos: muchos } } });
  montar();
  await userEvent.click(await screen.findByRole("button", { name: "Ver todos (12)" }));
  expect(screen.getAllByRole("link", { name: "Descargar" })).toHaveLength(12);
});
