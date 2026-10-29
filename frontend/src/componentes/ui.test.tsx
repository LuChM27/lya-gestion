import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Etiqueta, FotoProducto, Pastillas } from "./ui";

test("Pastillas marca solo la elegida y avisa el valor", async () => {
  const alElegir = vi.fn();
  render(<Pastillas etiqueta="Canal" opciones={[["feria", "Feria"], ["instagram", "Instagram"]]} valor="feria" alElegir={alElegir} />);
  expect(screen.getByRole("button", { name: "Feria" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(screen.getByRole("button", { name: "Instagram" }));
  expect(alElegir).toHaveBeenCalledWith("instagram");
});

test.each([
  ["ok", "En stock"],
  ["por_agotarse", "Por agotarse"],
  ["bajo_minimo", "Bajo mínimo"],
] as const)("Etiqueta %s dice %s", (estado, texto) => {
  render(<Etiqueta estado={estado} />);
  expect(screen.getByText(texto)).toBeInTheDocument();
});

test.each([
  ["crochet", "bg-rosa-claro"],
  ["murano", "bg-ok-fondo"],
  ["cristal", "bg-lila-fondo"],
  ["otro", "bg-alerta-fondo"],
])("FotoProducto sin foto de %s usa su color", (categoria, clase) => {
  const { container } = render(<FotoProducto foto={null} categoria={categoria} nombre="Bolso" />);
  expect(container.firstElementChild).toHaveClass(clase);
});

test("FotoProducto con foto muestra la miniatura", () => {
  render(<FotoProducto foto="0123456789abcdef.webp" categoria="crochet" nombre="Bolso balde" />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/fotos/0123456789abcdef-300.webp");
});
