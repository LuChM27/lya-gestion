import { expect, test } from "vitest";
import { cantidad, fecha, leerNumero, pesos } from "./formato";

test.each([
  ["12,5", 12.5],
  ["12.5", 12.5],
  ["1.200", 1200],
  ["1.200,5", 1200.5],
  ["125.000", 125000],
  ["$ 125.000", 125000],
  [" 3 ", 3],
  ["0,25", 0.25],
  ["", null],
  ["abc", null],
  ["1,2,3", null],
])("leerNumero(%j)", (texto, numero) => {
  expect(leerNumero(texto)).toBe(numero);
});

test("pesos sin decimales y con punto de miles", () => {
  expect(pesos(125000)).toBe("$ 125.000");
  expect(pesos(30.4)).toBe("$ 30");
  expect(pesos(0)).toBe("$ 0");
});

test("cantidad con coma decimal y sin ceros sobrantes", () => {
  expect(cantidad(12.5)).toBe("12,5");
  expect(cantidad(3)).toBe("3");
  expect(cantidad(1200)).toBe("1.200");
  expect(cantidad(0.125)).toBe("0,125");
  expect(cantidad(-1)).toBe("-1");
});

test("fecha en Bogotá como DD/MM/AAAA", () => {
  expect(fecha("2026-10-29T03:00:00Z")).toBe("28/10/2026");
  expect(fecha("2026-01-05T15:00:00Z")).toBe("05/01/2026");
});
