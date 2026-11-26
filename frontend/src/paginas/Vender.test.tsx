import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { simularApi } from "../pruebas/simular";
import Vender from "./Vender";

function Destino() {
  return <p>Detalle {useParams().id}</p>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/vender"]}>
      <Routes>
        <Route path="/vender" element={<Vender />} />
        <Route path="/ventas/:id" element={<Destino />} />
        <Route path="/productos" element={<p>Productos</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const ROSA = { variante_id: 3, modelo_id: 7, nombre: "Bolso balde", color: "Rosa palo", sku: "LA-0003", foto: null, categoria: "crochet", precio: 125000, existencia: 3 };
const NEGRO = { ...ROSA, variante_id: 4, color: "Negro", sku: "LA-0004", existencia: 1 };
const CUENTAS = [
  { id: 1, nombre: "Efectivo" },
  { id: 2, nombre: "Nequi" },
  { id: 3, nombre: "Daviplata" },
];
const VENTA = { id: 12, numero: "0012" };
const VALENTINA = { id: 5, nombre: "Valentina Ríos", whatsapp: "573004567812", instagram: "@valen.tejidos", total_comprado: 0, activo: true };

function api(extra = {}) {
  return simularApi({
    "GET /api/ventas/catalogo": { cuerpo: [ROSA, NEGRO] },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "POST /api/ventas": { estado: 201, cuerpo: VENTA },
    "GET /api/clientes": { cuerpo: [VALENTINA] },
    ...extra,
  });
}

const producto = (color: string) => screen.findByRole("button", { name: new RegExp(`^Bolso balde ${color}`) });
const enviado = (llamadas: { clave: string; cuerpo: unknown }[]) => llamadas.find((l) => l.clave === "POST /api/ventas")?.cuerpo;

// El localStorage de Node en las pruebas no es el del navegador: se usa uno en memoria.
beforeEach(() => {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
    clear: () => datos.clear(),
  });
});

test("tocar un producto lo agrega y Guardar envía la venta", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("Detalle 12")).toBeInTheDocument();
  expect(enviado(llamadas)).toEqual({
    canal: "presencial",
    cuenta_id: 1,
    descuento: 0,
    fecha: null,
    nota: null,
    items: [{ variante_id: 3, cantidad: 2 }],
  });
});

test("no suma más de lo que hay en vitrina", async () => {
  api();
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.click(await producto("Negro"));
  expect(screen.getByText("Solo hay 1 en vitrina.")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Total" })).getByText("$ 125.000")).toBeInTheDocument();
});

test("recuerda canal y cuenta del último uso", async () => {
  api();
  const { unmount } = montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: "Feria" }));
  await userEvent.click(screen.getByRole("button", { name: "Nequi" }));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  unmount();
  montar();
  await producto("Rosa palo");
  expect(screen.getByRole("button", { name: "Feria" })).toHaveAttribute("aria-pressed", "true");
  expect(await screen.findByRole("button", { name: "Nequi" })).toHaveAttribute("aria-pressed", "true");
});

test("descuento mayor que el subtotal no se envía", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.click(screen.getByRole("button", { name: "Más opciones" }));
  await userEvent.type(screen.getByLabelText("Descuento (opcional)"), "200.000");
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("El descuento no puede ser mayor que el subtotal.")).toBeInTheDocument();
  expect(enviado(llamadas)).toBeUndefined();
});

test("error del servidor se muestra", async () => {
  api({ "POST /api/ventas": { estado: 422, cuerpo: { detail: "Solo hay 0 de Bolso balde Negro." } } });
  montar();
  await userEvent.click(await producto("Negro"));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("Solo hay 0 de Bolso balde Negro.")).toBeInTheDocument();
});

test("sin productos en vitrina", async () => {
  api({ "GET /api/ventas/catalogo": { cuerpo: [] } });
  montar();
  expect(await screen.findByText("No hay productos en vitrina.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a productos" })).toHaveAttribute("href", "/productos");
});

test("fecha de otro día se envía", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: "Más opciones" }));
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-28" } });
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  expect(enviado(llamadas)).toMatchObject({ fecha: "2026-10-28" });
});

test("buscar filtra por color sin tildes", async () => {
  api();
  montar();
  await producto("Rosa palo");
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await userEvent.type(screen.getByLabelText("Buscar"), "rosá");
  expect(screen.queryByRole("button", { name: /^Bolso balde Negro/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Bolso balde Rosa palo/ })).toBeInTheDocument();
});

afterEach(() => vi.useRealTimers());

test("pantalla abierta desde antes de medianoche guarda la venta como de hoy", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T04:58:00Z")); // 29/10 a las 11:58 p. m. en Bogotá
  const llamadas = api();
  montar();
  await producto("Rosa palo");
  vi.setSystemTime(new Date("2026-10-30T05:02:00Z")); // ya es 30/10
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  expect(enviado(llamadas)).toMatchObject({ fecha: null });
});

test("si alguien vendió lo último, recarga la vitrina y lo saca de la venta", async () => {
  const rutas = {
    "GET /api/ventas/catalogo": { cuerpo: [ROSA, NEGRO] },
    "GET /api/cuentas": { cuerpo: CUENTAS },
    "POST /api/ventas": { estado: 422, cuerpo: { detail: "Solo hay 0 de Bolso balde Negro." } },
  };
  simularApi(rutas);
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(await producto("Negro"));
  rutas["GET /api/ventas/catalogo"] = { cuerpo: [ROSA] };
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  expect(await screen.findByText("Solo hay 0 de Bolso balde Negro.")).toBeInTheDocument();
  expect(await within(screen.getByRole("region", { name: "Total" })).findByText("$ 125.000")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Bolso balde Negro/ })).not.toBeInTheDocument();
});

test("tres pasos numerados", async () => {
  api();
  montar();
  expect(await screen.findByRole("heading", { level: 2, name: "1. ¿Qué vendiste?" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Venta rápida" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "2. ¿Por dónde te compró?" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "3. ¿Cómo te pagó?" })).toBeInTheDocument();
  expect(screen.getByText("3 toques")).toBeInTheDocument();
});

test("la tarjeta elegida muestra la cantidad", async () => {
  api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(await producto("Rosa palo"));
  const tarjeta = await producto("Rosa palo");
  expect(tarjeta).toHaveAttribute("aria-pressed", "true");
  expect(within(tarjeta).getByText("2")).toBeInTheDocument();
});

test("franja con total y cliente de mostrador", async () => {
  api();
  montar();
  const franja = within(await screen.findByRole("region", { name: "Total" }));
  expect(franja.getByText("Nada elegido aún")).toBeInTheDocument();
  expect(franja.getByRole("button", { name: "Elige un producto" })).toBeDisabled();
  await userEvent.click(await producto("Rosa palo"));
  expect(franja.getByText("1 producto")).toBeInTheDocument();
  expect(franja.getByText("$ 125.000")).toBeInTheDocument();
  expect(franja.getByText("Cliente de mostrador")).toBeInTheDocument();
  expect(franja.getByRole("button", { name: "Guardar venta" })).toBeEnabled();
});

test("descuento y fecha están en Más opciones", async () => {
  api();
  montar();
  await producto("Rosa palo");
  expect(screen.queryByLabelText("Descuento (opcional)")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Fecha")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Más opciones" }));
  expect(screen.getByLabelText("Descuento (opcional)")).toBeInTheDocument();
  expect(screen.getByLabelText("Fecha")).toBeInTheDocument();
});

test("Volver sin historial lleva a Inicio", async () => {
  api();
  render(
    <MemoryRouter initialEntries={["/vender"]}>
      <Routes>
        <Route path="/" element={<p>Pantalla de inicio</p>} />
        <Route path="/vender" element={<Vender />} />
      </Routes>
    </MemoryRouter>,
  );
  await producto("Rosa palo");
  await userEvent.click(screen.getByRole("button", { name: "Volver" }));
  expect(await screen.findByText("Pantalla de inicio")).toBeInTheDocument();
});

test("si la vitrina no carga, igual se puede volver", async () => {
  api({ "GET /api/ventas/catalogo": { estado: 500, cuerpo: { detail: "No se pudo cargar la vitrina." } } });
  montar();
  expect(await screen.findByText("No se pudo cargar la vitrina.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Venta rápida" })).toBeInTheDocument();
});

test("por defecto vende a mostrador", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  expect(screen.getByRole("button", { name: /Cliente de mostrador/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  expect(enviado(llamadas)).not.toHaveProperty("cliente_id");
});

test("elige una clienta", async () => {
  const llamadas = api();
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: /Cliente de mostrador/ }));
  const hoja = within(screen.getByRole("dialog", { name: "¿A quién le vendiste?" }));
  await userEvent.click(await hoja.findByRole("button", { name: /Valentina Ríos/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Valentina Ríos/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  expect(enviado(llamadas)).toMatchObject({ cliente_id: 5 });
});

test("crea una clienta desde la venta", async () => {
  const nueva = { ...VALENTINA, id: 9, nombre: "Camila Mejía", direccion: null, ciudad: null, correo: null, cedula: null, notas: null, enlace_whatsapp: "", creado: "2026-11-25T15:00:00Z", compras: 0, por_cobrar: 0, promedio: 0, canal_frecuente: null, ultima_compra: null, historial: [] };
  api({ "POST /api/clientes": { estado: 201, cuerpo: nueva } });
  montar();
  await producto("Rosa palo");
  await userEvent.click(screen.getByRole("button", { name: /Cliente de mostrador/ }));
  const hoja = within(screen.getByRole("dialog", { name: "¿A quién le vendiste?" }));
  await userEvent.click(hoja.getByRole("button", { name: "Nueva clienta" }));
  await userEvent.type(hoja.getByLabelText("Nombre"), "Camila Mejía");
  await userEvent.type(hoja.getByLabelText("WhatsApp"), "312 778 0011");
  await userEvent.click(hoja.getByRole("button", { name: "Guardar clienta" }));
  expect(await screen.findByRole("button", { name: /Camila Mejía/ })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("vuelve a mostrador después de guardar", async () => {
  api();
  const { unmount } = montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: "Feria" }));
  await userEvent.click(screen.getByRole("button", { name: /Cliente de mostrador/ }));
  await userEvent.click(await screen.findByRole("button", { name: /Valentina Ríos/ }));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  await screen.findByText("Detalle 12");
  unmount();
  montar();
  await producto("Rosa palo");
  expect(screen.getByRole("button", { name: /Cliente de mostrador/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Feria" })).toHaveAttribute("aria-pressed", "true");
});

test("cierra con Escape", async () => {
  api();
  montar();
  await producto("Rosa palo");
  const chip = screen.getByRole("button", { name: /Cliente de mostrador/ });
  await userEvent.click(chip);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(chip).toHaveFocus();
});

test("error de clienta archivada", async () => {
  api({ "POST /api/ventas": { estado: 422, cuerpo: { detail: "Elige una clienta de la lista." } } });
  montar();
  await userEvent.click(await producto("Rosa palo"));
  await userEvent.click(screen.getByRole("button", { name: /Cliente de mostrador/ }));
  await userEvent.click(await screen.findByRole("button", { name: /Valentina Ríos/ }));
  await userEvent.click(screen.getByRole("button", { name: /^Guardar venta/ }));
  const franja = within(screen.getByRole("region", { name: "Total" }));
  expect(await franja.findByText("Elige una clienta de la lista.")).toBeInTheDocument();
});

test("la hoja busca por Instagram y por número sin traer de más", async () => {
  const ana = { ...VALENTINA, id: 6, nombre: "Ana Pérez", whatsapp: "573152209087", instagram: null };
  api({ "GET /api/clientes": { cuerpo: [VALENTINA, ana] } });
  montar();
  await producto("Rosa palo");
  await userEvent.click(screen.getByRole("button", { name: /Cliente de mostrador/ }));
  const hoja = within(screen.getByRole("dialog"));
  const buscar = hoja.getByRole("searchbox");
  expect(buscar).toHaveFocus();
  await hoja.findByRole("button", { name: /Ana Pérez/ });
  const nombres = () => hoja.queryAllByRole("button", { name: /Valentina|Ana/ }).map((b) => b.textContent);
  fireEvent.change(buscar, { target: { value: "@valen" } });
  expect(nombres()).toEqual([expect.stringContaining("Valentina Ríos")]);
  fireEvent.change(buscar, { target: { value: "57" } });
  expect(nombres()).toEqual([]);
  fireEvent.change(buscar, { target: { value: "315 220" } });
  expect(nombres()).toEqual([expect.stringContaining("Ana Pérez")]);
});
