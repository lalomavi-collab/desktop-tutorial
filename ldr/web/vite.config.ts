import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the bundle works both at a domain root and on a
  // GitHub Pages project subpath (e.g. /desktop-tutorial/).
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
});
