import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";

// Keep everyone on the canonical www origin. The auth session lives in
// localStorage, which is per origin, so a user who signed in on www would look
// logged out on the bare apex (and vice versa). Redirect the apex to www once,
// preserving the full path, so a returning user stays signed in automatically.
if (window.location.hostname === "lawdin.online") {
  window.location.replace("https://www.lawdin.online" + window.location.pathname + window.location.search + window.location.hash);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
    <Analytics />
  </React.StrictMode>,
);
