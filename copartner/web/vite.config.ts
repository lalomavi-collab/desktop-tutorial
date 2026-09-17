import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CoPartner AI is a single, static marketing page (application funnel), so
// unlike lalum-app's multi-route SSG pipeline this stays a plain Vite build.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
