/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SCHEDULING_URL?: string;
  readonly VITE_A11Y_WIDGET_SRC?: string;
  readonly VITE_VIDEO_BUBBLE_SRC?: string;
  readonly VITE_VIDEO_BUBBLE_POSTER?: string;
  readonly VITE_VIDEO_BUBBLE_CAPTIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
