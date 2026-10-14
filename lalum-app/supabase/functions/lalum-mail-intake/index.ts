// lalum-mail-intake: Supabase Edge Function (Deno). Receives Microsoft Graph change notifications for ONE mailbox, decides which
// matter a new message belongs to (route.ts) and records the decision in lalum_mail_intake (migration 0041). It reads the mailbox
// and never sends. It is NOT deployed. A routed message is filed by file.ts through the existing secure path (the pipeline's server to
// server intake route, then the private vault); see that file for the order and the retry rules.
//
// Secrets (supabase secrets set ...), none of them in the repo:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   app registration with the APPLICATION permission Mail.Read only, limited to the
//                                                  one mailbox by an Exchange Application Access Policy (to be verified)
//   MS_MAILBOX                                     the mailbox address
//   MS_NOTIFY_CLIENT_STATE                         random secret the subscription was created with
//   LALUM_FIRM_ID, LALUM_MAIL_DOMAINS              the firm id and the domains of the matter aliases (comma separated)
//   LALUM_INTAKE_TOKEN                             the firm's intake token for lalum-pipeline (lit_ and 48 hex digits). No firm has one yet:
//                                                  it is created by the owner in lalum_private.firm_secrets and never shown in chat
//   MAIL_DRAIN_SECRET                              shared secret for the retry sweep (POST ?drain=1 with header x-drain-secret)
//   MAIL_MAX_BYTES                                 optional, default 26214400 (25 MB) for the raw message source
// Deploys need the owner's explicit approval; verify_jwt is false because Graph cannot send a Supabase JWT, so the clientState
// check in handler.ts is the gate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest, type IntakeRow, type MessageMeta, type Ports } from "./handler.ts";
import { fileOne, type FileDeps, type Pending } from "./file.ts";
import type { MatterInfo } from "./route.ts";

const env = (k: string) => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };
const db = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

async function graphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${env("MS_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("MS_CLIENT_ID"), client_secret: env("MS_CLIENT_SECRET"), scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return (await res.json()).access_token as string;
}

const mailbox = () => encodeURIComponent(env("MS_MAILBOX"));
const graphGet = async (id: string, suffix = "", extra: Record<string, string> = {}) =>
  fetch(`https://graph.microsoft.com/v1.0/users/${mailbox()}/messages/${encodeURIComponent(id)}${suffix}`, { headers: { Authorization: `Bearer ${await graphToken()}`, ...extra } });

const fileDeps = (sb: ReturnType<typeof db>, firmId: string): FileDeps => ({
  firmId,
  maxBytes: Number(Deno.env.get("MAIL_MAX_BYTES") ?? 26214400),
  async getText(id) {
    const res = await graphGet(id, "?$select=subject,body", { Prefer: 'outlook.body-content-type="text"' });
    if (!res.ok) return null;
    const m = await res.json();
    return { subject: m.subject ?? "", text: m.body?.content ?? "" };
  },
  async getMime(id) {
    const res = await graphGet(id, "/$value");
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  },
  async callPipeline({ text, fileName, matterId }) {
    const res = await fetch(`${env("SUPABASE_URL")}/functions/v1/lalum-pipeline/api/v1/intake/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env("LALUM_INTAKE_TOKEN")}`, "x-lalum-firm": firmId },
      body: JSON.stringify({ text, file_name: fileName, matter_id: matterId }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  },
  async upload(path, bytes) {
    const { error } = await sb.storage.from("matter-originals").upload(path, bytes, { contentType: "text/plain", upsert: false });
    if (!error) return "ok";
    return /exists|duplicate/i.test(error.message) ? "exists" : "error";
  },
  async setDocument(key, doc) { return !(await sb.rpc("lalum_mail_set_document", { p_firm: firmId, p_key: key, p_doc: doc })).error; },
  async attachOriginal(key, path, sha, size) { return !(await sb.rpc("lalum_mail_attach_original", { p_firm: firmId, p_key: key, p_path: path, p_sha256: sha, p_size: size })).error; },
  async setState(key, state, reason) { await sb.rpc("lalum_mail_set_state", { p_firm: firmId, p_key: key, p_state: state, p_reason: reason }); },
  log: (event, data) => console.log(`lalum-mail-intake: ${event} ${JSON.stringify(data)}`),
});

const toMatter = (r: { id: string; sync_enabled: boolean; status: string; conflict_status: string } | null): MatterInfo | undefined =>
  r ? { id: r.id, syncEnabled: r.sync_enabled, status: r.status, conflictStatus: r.conflict_status } : undefined;

const ports = (): Ports => {
  const sb = db();
  const firmId = env("LALUM_FIRM_ID");
  return {
    clientState: env("MS_NOTIFY_CLIENT_STATE"),
    aliasDomains: env("LALUM_MAIL_DOMAINS").split(",").map((d) => d.trim()).filter(Boolean),
    firmId,
    async fetchMeta(id): Promise<MessageMeta | null> {
      const sel = "internetMessageId,conversationId,subject,toRecipients,ccRecipients,receivedDateTime";
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env("MS_MAILBOX"))}/messages/${encodeURIComponent(id)}?$select=${sel}`,
        { headers: { Authorization: `Bearer ${await graphToken()}` } });
      if (!res.ok) return null;
      const m = await res.json();
      const addr = (l: Array<{ emailAddress?: { address?: string } }> | undefined) => (l ?? []).map((x) => x.emailAddress?.address ?? "").filter(Boolean);
      return { internetMessageId: m.internetMessageId ?? "", conversationId: m.conversationId ?? null, subject: m.subject ?? "", to: addr(m.toRecipients), cc: addr(m.ccRecipients), receivedAt: m.receivedDateTime };
    },
    async lookupMatterByCode(code) {
      const { data } = await sb.from("lalum_cockpit_matters").select("id, sync_enabled, status, conflict_status").eq("firm_id", firmId).eq("matter_code", code).is("deleted_at", null).maybeSingle();
      return toMatter(data);
    },
    async lookupThread(firm, conversationKey) {
      const { data: row } = await sb.from("lalum_mail_intake").select("matter_id").eq("firm_id", firm).eq("conversation_key", conversationKey).not("matter_id", "is", null).in("state", ["QUEUED", "FILED", "ASSIGNED"]).limit(1).maybeSingle();
      if (!row?.matter_id) return null;
      const { data } = await sb.from("lalum_cockpit_matters").select("id, sync_enabled, status, conflict_status").eq("id", row.matter_id).is("deleted_at", null).maybeSingle();
      return toMatter(data) ?? null;
    },
    async recordIntake(r: IntakeRow) {
      const { error } = await sb.from("lalum_mail_intake").insert({
        firm_id: r.firmId, message_key: r.messageKey, conversation_key: r.conversationKey, received_at: r.receivedAt, graph_message_id: r.graphId,
        route: r.decision.route, matter_id: r.decision.matterId, state: r.decision.state, reason: r.decision.reason,
      });
      if (!error) return "inserted";
      if (error.code === "23505") return "duplicate";
      throw new Error(`record ${error.code}`);
    },
    log: (event, data) => console.log(`lalum-mail-intake: ${event} ${JSON.stringify(data)}`),
    file: (p: Pending) => fileOne(fileDeps(sb, firmId), p),
    drainSecret: env("MAIL_DRAIN_SECRET"),
    async pending(limit) {
      const { data } = await sb.from("lalum_mail_intake").select("message_key, graph_message_id, matter_id, received_at, document_id")
        .eq("firm_id", firmId).in("state", ["QUEUED", "ASSIGNED"]).not("matter_id", "is", null).not("graph_message_id", "is", null).order("created_at").limit(limit);
      return (data ?? []).map((r) => ({ messageKey: r.message_key, graphId: r.graph_message_id, matterId: r.matter_id, receivedAt: r.received_at, documentId: r.document_id }));
    },
  };
};

Deno.serve((req) => handleRequest(req, ports()).catch((e) => {
  console.error(`lalum-mail-intake: failed ${String(e).slice(0, 120)}`);
  return new Response(null, { status: 500 });
}));
