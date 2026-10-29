import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test } from "vitest";
import Mas from "../paginas/Mas";
import { simularApi } from "../pruebas/simular";
import Marco from "./Marco";

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<Marco />}>
          <Route index element={<p>Inicio</p>} />
          <Route path="productos/:id" element={<p>Ficha</p>} />
          <Route path="vender" element={<p>Venta rápida</p>} />
          <Route path="mas" element={<Mas />} />
        </Route>
        <Route path="/entrar" element={<p>Pantalla de entrar</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("barra inferior: cuatro secciones y el + de nueva venta", () => {
  montar("/");
  const barra = within(screen.getByRole("navigation", { name: "Secciones" }));
  expect(barra.getByRole("link", { name: "Nueva venta" })).toHaveAttribute("href", "/vender");
  for (const [nombre, a] of [["Inicio", "/"], ["Ventas", "/ventas"], ["Inventario", "/inventario"], ["Más", "/mas"]]) {
    expect(barra.getByRole("link", { name: nombre })).toHaveAttribute("href", a);
  }
});

test("menú lateral con logo y secciones que existen", () => {
  montar("/");
  const menu = within(screen.getByRole("navigation", { name: "Menú" }));
  expect(menu.getAllByRole("link").map((a) => a.textContent)).toEqual(["Inicio", "Ventas", "Inventario"]);
  expect(screen.getAllByRole("img", { name: "L&A Tejidos" }).length).toBeGreaterThan(0);
});

test("Inventario queda activo en la ficha de un producto", () => {
  montar("/productos/7");
  const barra = within(screen.getByRole("navigation", { name: "Secciones" }));
  expect(barra.getByRole("link", { name: "Inventario" })).toHaveAttribute("aria-current", "page");
  const menu = within(screen.getByRole("navigation", { name: "Menú" }));
  expect(menu.getByRole("link", { name: "Inventario" })).toHaveAttribute("aria-current", "page");
});

test("la venta rápida no muestra la barra", () => {
  montar("/vender");
  expect(screen.getByText("Venta rápida")).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Secciones" })).not.toBeInTheDocument();
});

test("Más ofrece entrar desde el celular y salir", async () => {
  simularApi({
    "GET /api/acceso": { cuerpo: { nombre_local: "http://lya.local:8080", ip: "192.168.1.20" } },
    "POST /api/auth/salir": { estado: 204 },
  });
  montar("/mas");
  const pagina = within(screen.getByRole("main"));
  await userEvent.click(pagina.getByRole("button", { name: /Entrar desde el celular/ }));
  expect(await pagina.findByText(/lya\.local/)).toBeInTheDocument();
  await userEvent.click(pagina.getByRole("button", { name: "Salir" }));
  expect(await screen.findByText("Pantalla de entrar")).toBeInTheDocument();
});
