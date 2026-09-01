import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker (production only) so the site is an installable
// PWA and shows an offline screen. It is deliberately not registered in dev,
// where a caching worker only gets in the way of hot reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failing is non-fatal: the site works without the worker */
    });
  });
}
