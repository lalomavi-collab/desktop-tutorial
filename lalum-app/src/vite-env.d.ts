/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SCHEDULING_URL?: string;
  readonly VITE_A11Y_WIDGET_SRC?: string;
  /* Set to the clip's path to show the intro film in the quick-access menu;
     leave it unset and the menu simply omits that row. The poster and the
     captions are no longer read from the environment: the one player left
     (components/FounderIntroVideo.tsx) names its own files, so a declaration
     nothing reads would only invite someone to wire it back up. */
  readonly VITE_VIDEO_BUBBLE_SRC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
