/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Relative base so the build works on GitHub Pages (/Pantry-Prep/) or any other static host.
export default defineConfig({
  base: "./",
  build: { target: "es2020" },
  test: { include: ["src/**/*.test.ts"] },
});
