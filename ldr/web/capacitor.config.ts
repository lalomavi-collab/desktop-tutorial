import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.lawdin.app",
  appName: "LAWDin",
  webDir: "dist",
  server: {
    // Use HTTPS scheme so cookies and localStorage behave like a real browser.
    androidScheme: "https",
  },
  ios: {
    // Respect safe-area insets (notch, home indicator).
    contentInset: "always",
    preferredContentMode: "mobile",
    // Hide the native status bar background so our CSS safe-area CSS takes over.
    backgroundColor: "#1B1B29",
  },
  android: {
    backgroundColor: "#1B1B29",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1B1B29",
      androidSplashResourceName: "splash",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1B1B29",
    },
  },
};

export default config;
