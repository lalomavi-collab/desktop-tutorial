// lalum-mail-intake: Supabase Edge Function (Deno). Receives Microsoft Graph change notifications for ONE mailbox, decides which
// matter a new message belongs to (route.ts) and records the decision in lalum_mail_intake (migration 0041). It reads the mailbox
// and never sends. It is NOT deployed and filing into the vault is NOT wired yet: a routed message stays QUEUED.
//
// Secrets (supabase secrets set ...), none of them in the repo:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   app registration with the APPLICATION permission Mail.Read only, limited to the
//                                                  one mailbox by an Exchange Application Access Policy (to be verified)
//   MS_MAILBOX                                     the mailbox address
//   MS_NOTIFY_CLIENT_STATE                         random secret the subscription was created with
//   LALUM_FIRM_ID, LALUM_MAIL_DOMAINS              the firm id and the domains of the matter aliases (comma separated)
// Deploys need the owner's explicit approval; verify_jwt is false because Graph cannot send a Supabase JWT, so the clientState
// check in handler.ts is the gate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest, type IntakeRow, type MessageMeta, type Ports } from "./handler.ts";
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
        firm_id: r.firmId, message_key: r.messageKey, conversation_key: r.conversationKey, received_at: r.receivedAt,
        route: r.decision.route, matter_id: r.decision.matterId, state: r.decision.state, reason: r.decision.reason,
      });
      if (!error) return "inserted";
      if (error.code === "23505") return "duplicate";
      throw new Error(`record ${error.code}`);
    },
    log: (event, data) => console.log(`lalum-mail-intake: ${event} ${JSON.stringify(data)}`),
    // fileMessage and markFiled are deliberately absent until the vault path is decided (see docs section 5).
  };
};

Deno.serve((req) => handleRequest(req, ports()).catch((e) => {
  console.error(`lalum-mail-intake: failed ${String(e).slice(0, 120)}`);
  return new Response(null, { status: 500 });
}));
