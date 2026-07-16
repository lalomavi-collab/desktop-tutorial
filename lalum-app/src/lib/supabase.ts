import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Read Vite env. When either value is missing we run in DEMO mode: the client
// area still works end to end, backed by local state instead of the network.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
