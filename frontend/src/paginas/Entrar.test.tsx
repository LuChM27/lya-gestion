import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import Entrar from "./Entrar";

function montar() {
  return render(
    <MemoryRouter>
      <Entrar />
    </MemoryRouter>,
  );
}

test("entrar se ve como el mockup", () => {
  montar();
  expect(screen.getByRole("heading", { level: 1, name: "¡Qué bueno verte!" })).toBeInTheDocument();
  expect(screen.getByText("Entra para ver tus ventas, pedidos e inventario.")).toBeInTheDocument();
  expect(screen.getByText("Bolsos y accesorios hechos a mano, con todo en orden.")).toBeInTheDocument();
});

test("el ojo muestra y oculta la contraseña", async () => {
  montar();
  const contrasena = screen.getByLabelText("Contraseña");
  expect(contrasena).toHaveAttribute("type", "password");
  await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
  expect(contrasena).toHaveAttribute("type", "text");
  await userEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
  expect(contrasena).toHaveAttribute("type", "password");
});

test("recuperar acceso con el código", () => {
  montar();
  expect(screen.getByText(/Usa el código de 8 dígitos que viene en tu guía de instalación/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Recuperar acceso" })).toHaveAttribute("href", "/recuperar");
});
