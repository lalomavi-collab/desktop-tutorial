import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";

// Redirect bare apex to www so localStorage sessions are consistent.
if (window.location.hostname === "lawdin.online") {
  window.location.replace("https://www.lawdin.online" + window.location.pathname + window.location.search + window.location.hash);
}

// Native shell setup: hide the Capacitor splash screen once React is mounted,
// and configure the status bar to match the app chrome.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/splash-screen").then(({ SplashScreen }) => {
    SplashScreen.hide({ fadeOutDuration: 300 });
  });
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark });
    StatusBar.setBackgroundColor({ color: "#1B1B29" }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
    <Analytics />
  </React.StrictMode>,
);
