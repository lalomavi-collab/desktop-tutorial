/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /* Set to "true" to show the Google and Microsoft quick sign-in buttons on
     the login screen. Keep it unset until those providers are enabled and
     configured in the Supabase dashboard, so a visitor never meets a button
     that cannot complete. */
  readonly VITE_ENABLE_SSO?: string;
  readonly VITE_SCHEDULING_URL?: string;
  readonly VITE_A11Y_WIDGET_SRC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
