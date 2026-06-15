import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars are absent the client is null and all sync functions are no-ops.
export const supabase = url && key ? createClient(url, key) : null;
