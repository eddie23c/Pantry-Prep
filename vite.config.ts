/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the build works on GitHub Pages (/Pantry-Prep/) or any other static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020" },
  test: { include: ["src/**/*.test.ts"] },
});
