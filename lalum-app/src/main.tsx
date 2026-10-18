import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/sovereign.css";
import App from "./App";
import { preloadLang } from "./context/LangContext";

// The opening language's copy is fetched before the first render: it lives in
// its own chunk now (src/lib/strings/), so the five languages are no longer one
// 539KB download on every page.
void preloadLang().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

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
