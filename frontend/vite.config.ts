/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Safari 17.6 es el último disponible en macOS Monterey.
    target: "safari17",
    outDir: "dist",
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8080", "/fotos": "http://127.0.0.1:8080" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/pruebas/setup.ts"],
    // Con toda la suite corriendo en paralelo, las pruebas con muchos clics pasan de 5 s en equipos lentos.
    testTimeout: 15000,
  },
});
