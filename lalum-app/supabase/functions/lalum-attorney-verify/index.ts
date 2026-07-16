// lalum-attorney-verify: Supabase Edge Function (Deno) for the LALUM app.
// The only path that can set lalum_profiles.verification_status = 'verified'.
// Matches submitted (jurisdiction, license_no, name) against lalum_bar_registry.
// Self-contained: references only lalum_* tables, no other application.
//
// Deploy: supabase functions deploy lalum-attorney-verify
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role, server only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Normalize a name for exact matching: lowercase, strip punctuation and
// diacritics, collapse whitespace. Works for Latin and Hebrew input.
function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud/cantillation
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

type MatchResult = "auto_matched" | "name_mismatch" | "not_found" | "suspended";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { code: "not_configured" });

  // Resolve the caller from their JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  let body: { full_name?: string; license_no?: string; jurisdiction?: string };
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const fullName = (body.full_name ?? "").trim();
  const licenseNo = (body.license_no ?? "").trim();
  const jurisdiction = (body.jurisdiction ?? "IL").trim();
  if (!fullName || !licenseNo) return json(400, { code: "missing_fields" });

  const admin = createClient(url, serviceKey);

  const { data: row } = await admin
    .from("lalum_bar_registry")
    .select("id, full_name, status")
    .eq("jurisdiction", jurisdiction)
    .eq("license_no", licenseNo)
    .maybeSingle();

  let matchResult: MatchResult;
  let matchedId: string | null = null;
  let verified = false;

  if (!row) {
    matchResult = "not_found";
  } else if (row.status !== "active") {
    matchResult = "suspended";
    matchedId = row.id;
  } else if (normalizeName(fullName) === normalizeName(row.full_name)) {
    matchResult = "auto_matched";
    matchedId = row.id;
    verified = true;
  } else {
    matchResult = "name_mismatch";
    matchedId = row.id;
  }

  // Audit the submission.
  await admin.from("lalum_verification_requests").insert({
    user_id: user.id,
    submitted_name: fullName,
    submitted_license_no: licenseNo,
    jurisdiction,
    match_result: matchResult,
    matched_registry_id: matchedId,
  });

  // Only an exact match flips the profile to verified.
  if (verified) {
    await admin.from("lalum_profiles").upsert({ id: user.id, full_name: fullName, verification_status: "verified" });
  }

  return json(200, { match_result: matchResult, verified });
});
