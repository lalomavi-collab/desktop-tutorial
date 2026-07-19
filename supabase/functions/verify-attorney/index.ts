// verify-attorney — Supabase Edge Function (Deno).
// The ONLY path that can set ldr_profiles.verification_status = 'verified'.
// Matches submitted (jurisdiction, license_no, name) against bar_registry.
// See docs/11-verification-bar-registry.md.
//
// Deploy: supabase functions deploy verify-attorney
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role — server only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { namesMatchExact, nameSimilarity } from "../_shared/normalize.ts";

// Near-match threshold: above this we surface a candidate to the reviewer,
// but we still DO NOT auto-verify (only exact normalized match auto-verifies).
const REVIEW_SIMILARITY = 0.6;

type Body = {
  full_name?: string;
  license_no?: string;
  jurisdiction?: string;
  license_type?: "lawyer" | "intern";
};

type MatchResult =
  | "auto_matched" | "name_mismatch" | "not_found" | "suspended";

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  // Caller identity comes from the user's JWT; data writes use the service role.
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client bound to the caller's JWT — used only to resolve who they are.
  const asUser = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { code: "unauthorized" });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { code: "bad_json" }); }

  const fullName = (body.full_name ?? "").trim();
  const licenseNo = (body.license_no ?? "").trim();
  const jurisdiction = (body.jurisdiction ?? "IL").trim();
  const licenseType = body.license_type === "intern" ? "intern" : "lawyer";
  if (!fullName || !licenseNo) return json(400, { code: "missing_fields" });

  // Service-role client for privileged reads/writes (bypasses RLS by design;
  // this function IS the trusted authority for verification).
  const admin = createClient(url, serviceKey);

  // 1) Lookup by (jurisdiction, license_no).
  const { data: row } = await admin
    .from("bar_registry")
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
    matchResult = "suspended"; // suspended OR inactive → manual review
    matchedId = row.id;
  } else if (namesMatchExact(fullName, row.full_name)) {
    matchResult = "auto_matched";
    matchedId = row.id;
    verified = true;
  } else {
    // Found + active, but name not an exact normalized match → manual review.
    // (Similarity only decides whether we tag a strong candidate for the reviewer.)
    matchResult = "name_mismatch";
    matchedId = nameSimilarity(fullName, row.full_name) >= REVIEW_SIMILARITY
      ? row.id
      : null;
  }

  // 2) Record the request (full audit).
  await admin.from("verification_requests").insert({
    user_id: user.id,
    submitted_name: fullName,
    submitted_license_no: licenseNo,
    jurisdiction,
    match_result: matchResult,
    matched_registry_id: matchedId,
  });

  // 3) Update the profile. Only an exact active match sets 'verified';
  //    everything else goes to 'pending' for human review.
  const newStatus = verified ? "verified" : "pending";
  await admin.from("ldr_profiles").update({
    license_type: licenseType,
    license_no: licenseNo,
    verification_status: newStatus,
  }).eq("id", user.id);

  // 4) Respond WITHOUT leaking which field failed (anti-enumeration):
  //    callers learn only their resulting status.
  return json(200, { status: newStatus, request_id: undefined });
});
