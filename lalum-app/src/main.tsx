import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registers the service worker that makes the site PWA-installable (see
// public/sw.js for why this is required, not optional, for the "Install the
// app" buttons to do anything on Chrome/Edge). Skipped in dev so Vite's own
// dev server and HMR are never shadowed by a cached response.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: a browser without support, or a registration failure,
      // just leaves the site working as a normal page.
    });
  });
}
