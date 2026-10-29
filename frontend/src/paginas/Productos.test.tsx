import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Modelo from "./Modelo";
import Productos from "./Productos";

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/productos" element={<Productos />} />
        <Route path="/productos/:id" element={<Modelo />} />
      </Routes>
    </MemoryRouter>,
  );
}

const VARIANTE = {
  id: 3,
  color: "Rosa palo",
  sku: "LA-0003",
  stock_minimo: 2,
  foto: null,
  pieza_unica: false,
  activo: true,
  existencia: 1,
  estado: "bajo_minimo",
};
const MODELO = {
  id: 7,
  nombre: "Bolso balde",
  categoria: "crochet",
  precio_venta: 125000,
  horas_tejido: 6,
  foto: null,
  activo: true,
  unidades: 1,
  estado: "bajo_minimo",
  variantes: [VARIANTE],
};

afterEach(() => vi.restoreAllMocks());

test("lista vacía invita a agregar el primer modelo", async () => {
  simularApi({ "GET /api/inventario/modelos": { cuerpo: [] } });
  montar("/productos");
  expect(await screen.findByText("Todavía no hay productos.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Agregar el primer modelo" }));
  expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
});

test("la lista muestra precio, unidades y estado", async () => {
  simularApi({
    "GET /api/inventario/modelos": { cuerpo: [{ ...MODELO, variantes: 1 }] },
  });
  montar("/productos");
  expect(await screen.findByText("Bolso balde")).toBeInTheDocument();
  expect(screen.getByText("$ 125.000")).toBeInTheDocument();
  expect(screen.getByText("1 unidad")).toBeInTheDocument();
  expect(screen.getByText("Bajo mínimo")).toBeInTheDocument();
});

test("búsqueda sin resultados ofrece borrarla", async () => {
  simularApi({
    "GET /api/inventario/modelos": { cuerpo: [{ ...MODELO, variantes: 1 }] },
    "GET /api/inventario/modelos?buscar=zz": { cuerpo: [] },
  });
  montar("/productos");
  await screen.findByText("Bolso balde");
  await userEvent.type(screen.getByLabelText("Buscar"), "zz");
  expect(await screen.findByText("No hay productos que coincidan con “zz”.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
  expect(await screen.findByText("Bolso balde")).toBeInTheDocument();
});

test("crear modelo envía los datos y abre su ficha", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos": { cuerpo: [] },
    "POST /api/inventario/modelos": { estado: 201, cuerpo: { ...MODELO, variantes: [] } },
    "GET /api/inventario/modelos/7": { cuerpo: { ...MODELO, variantes: [] } },
  });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar modelo" }));
  await userEvent.type(screen.getByLabelText("Nombre"), "Bolso balde");
  await userEvent.type(screen.getByLabelText("Precio de venta"), "125.000");
  await userEvent.type(screen.getByLabelText("Horas de tejido"), "6,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar modelo" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Bolso balde" })).toBeInTheDocument();
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/modelos")?.cuerpo).toEqual({
    nombre: "Bolso balde",
    categoria: "crochet",
    precio_venta: 125000,
    horas_tejido: 6.5,
    foto: null,
  });
});

test("número mal escrito no se envía", async () => {
  const llamadas = simularApi({ "GET /api/inventario/modelos": { cuerpo: [] } });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar modelo" }));
  await userEvent.type(screen.getByLabelText("Nombre"), "Bolso");
  await userEvent.type(screen.getByLabelText("Precio de venta"), "mucho");
  await userEvent.click(screen.getByRole("button", { name: "Guardar modelo" }));
  expect(await screen.findByText("Escribe un número, por ejemplo 12,5.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.startsWith("POST"))).toBe(false);
});

test("sumar a vitrina envía la cantidad", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "POST /api/inventario/variantes/3/movimientos": { estado: 201, cuerpo: { ...VARIANTE, existencia: 3 } },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Sumar a vitrina" }));
  await userEvent.type(screen.getByLabelText("Cantidad"), "2");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/variantes/3/movimientos")?.cuerpo).toEqual({
    tipo: "ingreso_vitrina",
    cantidad: 2,
  });
});

test("merma mayor que la existencia muestra el mensaje del servidor", async () => {
  simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "POST /api/inventario/variantes/3/movimientos": { estado: 422, cuerpo: { detail: "Solo hay 1." } },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Registrar merma" }));
  await userEvent.type(screen.getByLabelText("Cantidad"), "5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByText("Solo hay 1.")).toBeInTheDocument();
});

test("contar envía la cantidad contada", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "POST /api/inventario/variantes/3/conteo": { cuerpo: { ...VARIANTE, existencia: 0 } },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Contar" }));
  await userEvent.type(screen.getByLabelText("Cantidad contada"), "0");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/variantes/3/conteo")?.cuerpo).toEqual({
    cantidad_contada: 0,
  });
});

test("agregar variante envía color y stock mínimo", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "POST /api/inventario/modelos/7/variantes": { estado: 201, cuerpo: { ...VARIANTE, id: 4, color: "Negro" } },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar variante" }));
  await userEvent.type(screen.getByLabelText("Color"), "Negro");
  await userEvent.type(screen.getByLabelText("Stock mínimo"), "1");
  await userEvent.click(screen.getByRole("button", { name: "Guardar variante" }));
  expect(llamadas.find((l) => l.clave === "POST /api/inventario/modelos/7/variantes")?.cuerpo).toEqual({
    color: "Negro",
    sku: null,
    stock_minimo: 1,
    pieza_unica: false,
    foto: null,
  });
});

test("historial de movimientos en palabras", async () => {
  simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "GET /api/inventario/variantes/3/movimientos": {
      cuerpo: [
        { id: 2, fecha: "2026-10-29T15:00:00Z", tipo: "ajuste", cantidad: -1, nota: null },
        { id: 1, fecha: "2026-10-28T15:00:00Z", tipo: "ingreso_vitrina", cantidad: 2, nota: null },
      ],
    },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Ver movimientos" }));
  expect(await screen.findByText("Ajuste por conteo")).toBeInTheDocument();
  expect(screen.getByText("Ingreso a vitrina")).toBeInTheDocument();
  expect(screen.getByText("+2")).toBeInTheDocument();
  expect(screen.getByText("-1")).toBeInTheDocument();
  expect(screen.getByText("29/10/2026")).toBeInTheDocument();
});

test("archivar pide confirmación antes de borrar", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "DELETE /api/inventario/modelos/7": { estado: 204 },
    "GET /api/inventario/modelos": { cuerpo: [] },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Archivar modelo" }));
  expect(screen.getByText("¿Archivar Bolso balde? Sus ventas y movimientos se conservan.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.startsWith("DELETE"))).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Archivar" }));
  expect(await screen.findByText("Todavía no hay productos.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave === "DELETE /api/inventario/modelos/7")).toBe(true);
});

test("foto que no se puede leer muestra el error", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("HEIC")));
  simularApi({ "GET /api/inventario/modelos": { cuerpo: [] } });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar modelo" }));
  const archivo = new File(["x"], "foto.heic", { type: "image/heic" });
  await userEvent.upload(screen.getByLabelText("Foto"), archivo);
  expect(
    await screen.findByText("No se pudo leer esa foto. Prueba con otra o expórtala como JPEG."),
  ).toBeInTheDocument();
});

test("foto JPEG sube tal cual para que el servidor la enderece", async () => {
  const leer = vi.fn();
  vi.stubGlobal("createImageBitmap", leer);
  const llamadas = simularApi({
    "GET /api/inventario/modelos": { cuerpo: [] },
    "POST /api/fotos": { estado: 201, cuerpo: { foto: "0123456789abcdef.webp", miniatura: "0123456789abcdef-300.webp" } },
  });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar modelo" }));
  const original = new File(["jpeg"], "a.jpg", { type: "image/jpeg" });
  await userEvent.upload(screen.getByLabelText("Foto"), original);
  await screen.findByRole("img", { name: "Foto del producto" });
  expect(leer).not.toHaveBeenCalled();
  const form = llamadas.find((l) => l.clave === "POST /api/fotos")?.cuerpo as FormData;
  expect((form.get("archivo") as File).name).toBe("a.jpg");
});

test("archivados se ven y se vuelven a usar", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos": { cuerpo: [] },
    "GET /api/inventario/modelos?archivados=true": { cuerpo: [{ ...MODELO, activo: false, variantes: 1 }] },
    "GET /api/inventario/modelos/7": { cuerpo: { ...MODELO, activo: false } },
    "POST /api/inventario/modelos/7/restaurar": { cuerpo: MODELO },
  });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Ver archivados" }));
  await userEvent.click(await screen.findByText("Bolso balde"));
  await userEvent.click(await screen.findByRole("button", { name: "Volver a usar" }));
  expect(llamadas.some((l) => l.clave === "POST /api/inventario/modelos/7/restaurar")).toBe(true);
  expect(await screen.findByRole("button", { name: "Archivar modelo" })).toBeInTheDocument();
});

test("editar variante envía los cambios", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "PUT /api/inventario/variantes/3": { cuerpo: { ...VARIANTE, color: "Rosa viejo" } },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Editar variante" }));
  const color = screen.getByLabelText("Color");
  expect(color).toHaveValue("Rosa palo");
  await userEvent.clear(color);
  await userEvent.type(color, "Rosa viejo");
  await userEvent.click(screen.getByRole("button", { name: "Guardar variante" }));
  expect(llamadas.find((l) => l.clave === "PUT /api/inventario/variantes/3")?.cuerpo).toEqual({
    color: "Rosa viejo",
    sku: "LA-0003",
    stock_minimo: 2,
    pieza_unica: false,
    foto: null,
  });
});

test("archivar variante pide confirmación", async () => {
  const llamadas = simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "DELETE /api/inventario/variantes/3": { estado: 204 },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Archivar variante" }));
  expect(screen.getByText("¿Archivar Rosa palo? Sus ventas y movimientos se conservan.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Archivar" }));
  expect(llamadas.some((l) => l.clave === "DELETE /api/inventario/variantes/3")).toBe(true);
});

test.each([
  ["0", "Escribe una cantidad mayor que 0."],
  ["0,5", "Los productos se cuentan en unidades enteras."],
])("merma de %s no se envía", async (texto, mensaje) => {
  const llamadas = simularApi({ "GET /api/inventario/modelos/7": { cuerpo: MODELO } });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Registrar merma" }));
  await userEvent.type(screen.getByLabelText("Cantidad"), texto);
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByText(mensaje)).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.startsWith("POST"))).toBe(false);
});

test("foto se reduce en el navegador y se sube", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }));
  const dibujar = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: dibujar } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (listo) {
    listo(new Blob(["jpeg"], { type: "image/jpeg" }));
  });
  const llamadas = simularApi({
    "GET /api/inventario/modelos": { cuerpo: [] },
    "POST /api/fotos": { estado: 201, cuerpo: { foto: "0123456789abcdef.webp", miniatura: "0123456789abcdef-300.webp" } },
  });
  montar("/productos");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar modelo" }));
  await userEvent.upload(screen.getByLabelText("Foto"), new File(["x"], "a.heic", { type: "image/heic" }));
  expect(await screen.findByRole("img", { name: "Foto del producto" })).toHaveAttribute(
    "src",
    "/fotos/0123456789abcdef-300.webp",
  );
  expect(dibujar).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
  expect(llamadas.find((l) => l.clave === "POST /api/fotos")?.cuerpo).toBeInstanceOf(FormData);
});

test.each([
  ["Sumar a vitrina", "Cantidad"],
  ["Contar", "Cantidad contada"],
])("%s con decimales no se envía", async (boton, campo) => {
  const llamadas = simularApi({ "GET /api/inventario/modelos/7": { cuerpo: MODELO } });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: boton }));
  await userEvent.type(screen.getByLabelText(campo), "1,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(await screen.findByText("Los productos se cuentan en unidades enteras.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.startsWith("POST"))).toBe(false);
});

test("stock mínimo de variante con decimales no se envía", async () => {
  const llamadas = simularApi({ "GET /api/inventario/modelos/7": { cuerpo: MODELO } });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Agregar variante" }));
  await userEvent.type(screen.getByLabelText("Color"), "Negro");
  await userEvent.type(screen.getByLabelText("Stock mínimo"), "1,5");
  await userEvent.click(screen.getByRole("button", { name: "Guardar variante" }));
  expect(await screen.findByText("Los productos se cuentan en unidades enteras.")).toBeInTheDocument();
  expect(llamadas.some((l) => l.clave.startsWith("POST"))).toBe(false);
});

test("una venta anulada se ve así en el historial", async () => {
  simularApi({
    "GET /api/inventario/modelos/7": { cuerpo: MODELO },
    "GET /api/inventario/variantes/3/movimientos": {
      cuerpo: [{ id: 3, fecha: "2026-10-29T16:00:00Z", tipo: "anulacion", cantidad: 1, nota: "Venta N.º 0012 anulada" }],
    },
  });
  montar("/productos/7");
  await userEvent.click(await screen.findByRole("button", { name: "Ver movimientos" }));
  expect(await screen.findByText("Venta anulada")).toBeInTheDocument();
});
