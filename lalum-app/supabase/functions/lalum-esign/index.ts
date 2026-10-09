// LALUM external e-signature bridge (DocuSeal).
//
// A signing request prepared in the cockpit can be handed to DocuSeal instead of
// signed in the portal: DocuSeal emails the signer a link, the signer signs on
// DocuSeal's hosted page, and a webhook reports the outcome and the signed PDF
// back here. DocuSeal is chosen because it is open source and free, and can be
// self-hosted (set DOCUSEAL_BASE_URL to the self-hosted instance) so the signed
// documents never leave infrastructure the firm controls.
//
// Routes (by ?action= in the query, or "action" in the JSON body):
//   status  : firm member, checks whether the provider is configured and reachable.
//   send    : firm member, creates a DocuSeal submission for a DRAFT request.
//   webhook : DocuSeal -> us, authenticated by ?secret=DOCUSEAL_WEBHOOK_SECRET.
//
// Required secrets: DOCUSEAL_API_KEY (to activate), DOCUSEAL_WEBHOOK_SECRET.
// Optional: DOCUSEAL_BASE_URL (default https://api.docuseal.com).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DS_KEY = Deno.env.get("DOCUSEAL_API_KEY") ?? "";
const DS_BASE = (Deno.env.get("DOCUSEAL_BASE_URL") ?? "https://api.docuseal.com").replace(/\/+$/, "");
const WH_SECRET = Deno.env.get("DOCUSEAL_WEBHOOK_SECRET") ?? "";

const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sha256hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// DocuSeal REST call. Auth is the X-Auth-Token header. Kept in one place so the
// endpoint and field names are easy to adjust if the provider's API changes.
async function ds(path: string, init?: RequestInit) {
  const r = await fetch(DS_BASE + path, {
    ...init,
    headers: { "X-Auth-Token": DS_KEY, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await r.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data } as { ok: boolean; status: number; data: any };
}

// The document, as an HTML template with one signature field for the signer.
function templateHtml(title: string, content: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
    body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.8;direction:rtl;padding:32px}
    h1{font-size:19pt;text-align:center}.body{white-space:pre-wrap}.sig{margin-top:40px}
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="body">${esc(content)}</div>
    <div class="sig">חתימת הלקוח:
      <signature-field name="Signature" role="First Party" required="true" style="width:220px;height:48px;"></signature-field>
    </div>
  </body></html>`;
}

async function callerUser(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}

async function firmMembership(userId: string) {
  const { data } = await admin.from("lalum_firm_members").select("firm_id, role").eq("user_id", userId).maybeSingle();
  return data as { firm_id: string; role: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as any));
  const action = url.searchParams.get("action") ?? body?.action;

  // DocuSeal -> us. Authenticated by the shared secret in the URL.
  if (action === "webhook") {
    if (!WH_SECRET || url.searchParams.get("secret") !== WH_SECRET) return json({ error: "unauthorized" }, 401);
    const event = String(body?.event_type ?? "");
    const d = body?.data ?? {};
    const subId = d?.submission_id != null ? String(d.submission_id) : null;
    if (!subId) return json({ ok: true, ignored: "no submission_id" });
    const { data: reqRow } = await admin.from("lalum_signature_requests")
      .select("id, firm_id, matter_id, content_sha256, status").eq("provider", "DOCUSEAL")
      .eq("provider_submission_id", subId).maybeSingle();
    if (!reqRow) return json({ ok: true, ignored: "no match" });

    const patch: Record<string, unknown> = {};
    let auditAction: string | null = null;
    if (event === "form.viewed" && reqRow.status === "SENT") { patch.status = "VIEWED"; patch.viewed_at = new Date().toISOString(); }
    else if (event === "form.completed") {
      patch.status = "SIGNED"; patch.signed_at = new Date().toISOString(); patch.signed_consent = true;
      patch.signed_name = d?.name ?? d?.email ?? null;
      const docUrl = Array.isArray(d?.documents) && d.documents[0]?.url ? d.documents[0].url : (d?.audit_log_url ?? null);
      patch.signed_document_url = docUrl;
      auditAction = "SIGNATURE_SIGNED";
    } else if (event === "form.declined") {
      patch.status = "DECLINED"; patch.declined_at = new Date().toISOString();
      patch.decline_reason = d?.decline_reason ?? null;
      auditAction = "SIGNATURE_DECLINED";
    } else {
      return json({ ok: true, ignored: event });
    }
    await admin.from("lalum_signature_requests").update(patch).eq("id", reqRow.id);
    if (auditAction) {
      await admin.rpc("lalum_append_audit", {
        p_firm: reqRow.firm_id, p_matter: reqRow.matter_id, p_actor: null,
        p_action: auditAction, p_ai_hash: reqRow.content_sha256 || null,
        p_meta: { request: reqRow.id, provider: "DOCUSEAL", submission: subId },
      });
    }
    return json({ ok: true });
  }

  // From here on, the caller is a firm member.
  const user = await callerUser(req);
  if (!user) return json({ error: "unauthenticated" }, 401);
  const member = await firmMembership(user.id);
  if (!member || !["FIRM_PARTNER", "ATTORNEY", "ADMIN"].includes(member.role)) return json({ error: "not allowed" }, 403);

  if (action === "status") {
    if (!DS_KEY) return json({ configured: false, baseUrl: DS_BASE });
    const probe = await ds("/templates?limit=1");
    return json({ configured: true, baseUrl: DS_BASE, reachable: probe.ok, providerStatus: probe.status });
  }

  if (action === "send") {
    if (!DS_KEY) return json({ error: "provider_not_configured", message: "DocuSeal אינו מוגדר עדיין. יש להוסיף את המפתח DOCUSEAL_API_KEY." }, 400);
    const requestId = String(body?.request_id ?? "");
    if (!requestId) return json({ error: "request_id required" }, 400);
    const { data: r } = await admin.from("lalum_signature_requests").select("*").eq("id", requestId).maybeSingle();
    if (!r) return json({ error: "not found" }, 404);
    if (r.firm_id !== member.firm_id) return json({ error: "not allowed" }, 403);
    if (r.status !== "DRAFT") return json({ error: "already sent" }, 400);
    if (!r.signer_email || !r.content) return json({ error: "incomplete" }, 400);

    const tpl = await ds("/templates/html", { method: "POST", body: JSON.stringify({ name: r.title || "LALUM document", html: templateHtml(r.title, r.content) }) });
    if (!tpl.ok || !tpl.data?.id) return json({ error: "provider_error", step: "template", status: tpl.status, detail: tpl.data }, 502);

    const sub = await ds("/submissions", { method: "POST", body: JSON.stringify({ template_id: tpl.data.id, send_email: true, submitters: [{ role: "First Party", email: r.signer_email, name: r.signer_name || undefined }] }) });
    const first = Array.isArray(sub.data) ? sub.data[0] : (sub.data?.submitters?.[0] ?? sub.data);
    const submissionId = first?.submission_id ?? sub.data?.id;
    if (!sub.ok || submissionId == null) return json({ error: "provider_error", step: "submission", status: sub.status, detail: sub.data }, 502);

    await admin.from("lalum_signature_requests").update({
      provider: "DOCUSEAL", provider_submission_id: String(submissionId), provider_slug: first?.slug ?? null,
      status: "SENT", sent_at: new Date().toISOString(), content_sha256: await sha256hex(r.content),
    }).eq("id", r.id);
    await admin.rpc("lalum_append_audit", {
      p_firm: r.firm_id, p_matter: r.matter_id, p_actor: user.id, p_action: "SIGNATURE_SENT", p_ai_hash: null,
      p_meta: { request: r.id, provider: "DOCUSEAL", submission: submissionId },
    });
    return json({ ok: true, submission_id: submissionId, sign_url: first?.slug ? `${DS_BASE.replace("api.", "")}/s/${first.slug}` : null });
  }

  return json({ error: "unknown action" }, 400);
});
