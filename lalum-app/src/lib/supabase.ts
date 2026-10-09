import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Read Vite env. When either value is missing we run in DEMO mode: the client
// area still works end to end, backed by local state instead of the network.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// "Remember me" aware auth storage. When the visitor opts out (flag "0"), the
// auth token lives only in sessionStorage and is cleared when the browser
// closes; otherwise it persists in localStorage so they stay signed in on this
// device and the browser's password manager can offer to save the password.
//
// Every call is wrapped in try/catch: some browsers throw a SecurityError on
// localStorage/sessionStorage access rather than just returning an empty
// store (seen in Chrome Incognito under a strict site-data policy). Before
// this guard, that throw happened inside the Supabase client's own auth
// init, at module scope, which every page imports: one visitor whose browser
// blocks storage got a blank page everywhere, not just a signed-out /portal.
export const REMEMBER_KEY = "lalum_remember";
const authStorage =
  typeof window !== "undefined"
    ? {
        getItem: (k: string) => {
          try {
            return window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItem: (k: string, v: string) => {
          try {
            const remember = window.localStorage.getItem(REMEMBER_KEY) !== "0";
            (remember ? window.localStorage : window.sessionStorage).setItem(k, v);
            // Never let the token linger in the other store after a switch.
            (remember ? window.sessionStorage : window.localStorage).removeItem(k);
          } catch {
            // Storage blocked: the session simply will not persist across
            // reloads, which is the same experience as "remember me" off.
          }
        },
        removeItem: (k: string) => {
          try {
            window.localStorage.removeItem(k);
            window.sessionStorage.removeItem(k);
          } catch {
            /* ignore */
          }
        },
      }
    : undefined;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, storage: authStorage },
    })
  : null;

// The recovery link lands with the token already in the URL, and the client
// processes it (and fires PASSWORD_RECOVERY) as soon as this module loads,
// not when some later component asks. ResetPassword is a lazy route: by the
// time its own chunk downloads and its effect subscribes, the event has
// already been delivered to whoever was listening first (AuthContext, which
// only reads the session and ignores the event name) and a new subscriber
// only replays INITIAL_SESSION. Subscribing here, at module scope, catches it
// at the earliest possible point instead.
export let passwordRecovery = false;
supabase?.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") passwordRecovery = true;
});
