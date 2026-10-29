import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { simularApi } from "../pruebas/simular";
import AccesoCelular from "./AccesoCelular";

test("acceso desde el celular muestra QR y enlaces", async () => {
  simularApi({
    "GET /api/acceso": {
      cuerpo: { nombre_local: "http://lya-tejidos.local:8080", ip: "http://192.168.1.23:8080" },
    },
  });
  const { container } = render(<AccesoCelular />);
  expect(await screen.findByText("http://lya-tejidos.local:8080")).toBeInTheDocument();
  expect(screen.getByText("http://192.168.1.23:8080")).toBeInTheDocument();
  expect(container.querySelector("svg")).not.toBeNull();
});

test("sin IP muestra solo el nombre .local", async () => {
  simularApi({
    "GET /api/acceso": { cuerpo: { nombre_local: "http://lya-tejidos.local:8080", ip: null } },
  });
  render(<AccesoCelular />);
  expect(await screen.findByText("http://lya-tejidos.local:8080")).toBeInTheDocument();
  expect(screen.queryByText(/Si no abre/)).not.toBeInTheDocument();
});
