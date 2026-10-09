// lalum-mfa-recovery: one-time recovery codes for the TOTP second factor.
//
// POST { action: "generate" }          caller must hold an aal2 session. Replaces any
//                                      existing codes with 8 new ones and returns them
//                                      in plain text exactly once.
// POST { action: "redeem", code }      caller holds an aal1 session (signed in with the
//                                      password). A valid unused code is consumed and all
//                                      of the caller's TOTP factors are removed, so the
//                                      account can enrol a fresh authenticator.
//
// Only salted hashes are stored (see migration 0008). Five wrong guesses lock redemption
// for fifteen minutes. A successful redemption never reveals or returns a factor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const CODE_COUNT = 8;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const normalize = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

async function hash(userId: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${normalize(code)}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The caller's assurance level comes from their own verified JWT payload.
function aalOf(jwt: string): string {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.aal ?? "aal1");
  } catch {
    return "aal1";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  const admin = createClient(url, serviceKey);
  let body: { action?: string; code?: string };
  try { body = await req.json(); } catch { body = {}; }

  if (body.action === "generate") {
    if (aalOf(jwt) !== "aal2") return json(403, { code: "mfa_required" });
    const codes = Array.from({ length: CODE_COUNT }, newCode);
    await admin.from("lalum_mfa_recovery_codes").delete().eq("user_id", user.id);
    const rows = await Promise.all(codes.map(async (c) => ({ user_id: user.id, code_hash: await hash(user.id, c) })));
    const { error } = await admin.from("lalum_mfa_recovery_codes").insert(rows);
    if (error) return json(500, { code: "store_failed" });
    return json(200, { codes });
  }

  if (body.action === "redeem") {
    const code = (body.code ?? "").toString();
    if (normalize(code).length !== 10) return json(400, { code: "bad_code" });

    const { data: st } = await admin.from("lalum_mfa_recovery_state").select("failed, locked_until").eq("user_id", user.id).maybeSingle();
    if (st?.locked_until && new Date(st.locked_until) > new Date()) return json(429, { code: "locked" });

    const { data: match } = await admin
      .from("lalum_mfa_recovery_codes")
      .select("id")
      .eq("user_id", user.id)
      .eq("code_hash", await hash(user.id, code))
      .is("used_at", null)
      .maybeSingle();

    if (!match) {
      const failed = (st?.failed ?? 0) + 1;
      const locked = failed >= MAX_FAILED;
      await admin.from("lalum_mfa_recovery_state").upsert({
        user_id: user.id,
        failed: locked ? 0 : failed,
        locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      });
      return json(403, { code: "invalid_code" });
    }

    // Consume first, so a failure after this point can never leave a reusable code behind.
    const { error: useErr } = await admin.from("lalum_mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", match.id).is("used_at", null);
    if (useErr) return json(500, { code: "store_failed" });
    await admin.from("lalum_mfa_recovery_state").upsert({ user_id: user.id, failed: 0, locked_until: null });

    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    for (const f of factors?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    }
    return json(200, { ok: true });
  }

  return json(400, { code: "bad_action" });
});
