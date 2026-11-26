import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Con la suite completa en paralelo, 1 s de espera por defecto no alcanza en equipos lentos.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
