import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This is its own Supabase project (see .env.example), separate from
// lalum-app and ldr/web, provisioned separately by the operator. Until that
// happens the env vars are empty in every environment, so callers must
// treat `supabase` as possibly absent rather than assume it always exists.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export interface Application {
  full_name: string;
  professional_title: string;
  primary_domain: string;
  years_of_practice: string;
  academic_background: string;
  current_practice: string;
  client_profile: string;
  email: string;
  phone: string;
  website: string;
  transform_note: string;
}

export async function submitApplication(app: Application): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) {
    // No backend provisioned yet: fail open so the funnel still works during
    // this build phase, rather than pretend a network call happened.
    console.warn("[copartner] Supabase not configured; application was not persisted.", app);
    return { ok: true };
  }
  const { error } = await supabase.from("copartner_applications").insert(app);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
