import { defineConfig } from "vite";

// Relative base so the build works on GitHub Pages (/pantry-prep/) or any other static host.
export default defineConfig({
  base: "./",
  build: { target: "es2020" },
});
