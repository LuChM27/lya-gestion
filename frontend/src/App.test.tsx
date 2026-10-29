import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import App from "./App";
import { simularApi } from "./pruebas/simular";

function montar(ruta = "/") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

test("sin cuenta configurada lleva a crear cuenta", async () => {
  simularApi({ "GET /api/auth/estado": { cuerpo: { configurado: false } } });
  montar();
  expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
});

test("con cuenta y sin sesión lleva a entrar", async () => {
  simularApi({
    "GET /api/auth/estado": { cuerpo: { configurado: true } },
    "GET /api/auth/yo": { estado: 401, cuerpo: { detail: "Inicia sesión para continuar." } },
  });
  montar();
  expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
});

test("crear cuenta muestra el código de recuperación una vez", async () => {
  const llamadas = simularApi({
    "GET /api/auth/estado": { cuerpo: { configurado: false } },
    "POST /api/auth/configurar": { estado: 201, cuerpo: { codigo_recuperacion: "48213907" } },
  });
  montar("/crear-cuenta");
  await userEvent.type(await screen.findByLabelText("Usuario"), "laura");
  await userEvent.type(screen.getByLabelText("Contraseña"), "tejidos2026");
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByText("48213907")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ya lo anoté" })).toBeInTheDocument();
  expect(llamadas.find((l) => l.clave === "POST /api/auth/configurar")?.cuerpo).toEqual({
    usuario: "laura",
    contrasena: "tejidos2026",
  });
});

test("error de entrada muestra el texto del servidor", async () => {
  simularApi({
    "GET /api/auth/estado": { cuerpo: { configurado: true } },
    "GET /api/auth/yo": { estado: 401, cuerpo: { detail: "Inicia sesión para continuar." } },
    "POST /api/auth/entrar": { estado: 401, cuerpo: { detail: "Usuario o contraseña incorrectos." } },
  });
  montar("/entrar");
  const usuario = await screen.findByLabelText("Usuario");
  await userEvent.type(usuario, "laura");
  await userEvent.type(screen.getByLabelText("Contraseña"), "mala-clave");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Usuario o contraseña incorrectos.")).toBeInTheDocument();
  expect(usuario).toHaveValue("laura");
});
