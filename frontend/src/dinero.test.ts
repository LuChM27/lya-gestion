import { expect, test } from "vitest";
import { leerPesos, mesAnterior, mesSiguiente, nombreMes } from "./dinero";

test("leerPesos acepta puntos de miles y el signo pesos", () => {
  expect(leerPesos("$ 150.000")).toBe(150000);
  expect(leerPesos("150.000")).toBe(150000);
  expect(leerPesos("150000")).toBe(150000);
  expect(leerPesos("12,5")).toBeNull();
  expect(leerPesos("abc")).toBeNull();
  expect(leerPesos("")).toBeNull();
});

test("meses", () => {
  expect(nombreMes("2026-11")).toBe("noviembre");
  expect(mesAnterior("2026-01")).toBe("2025-12");
  expect(mesSiguiente("2026-12")).toBe("2027-01");
});
