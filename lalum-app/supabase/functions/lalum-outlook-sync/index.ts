// lalum-outlook-sync: Supabase Edge Function (Deno). pg_cron calls it once a day (migration 20261024170100); it reads the owner's
// Outlook calendar through Microsoft Graph and brings public.lalum_events in line with it. It replaces the Claude routine that
// stalled on SQL approval prompts (T73): no Claude, no connector, no tokens. It is NOT deployed.
//
// Secrets (the owner pastes them into the Supabase function secrets; never in the repo, never in chat):
//   MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET   app registration "LALUM calendar sync". It has NO Graph API
//       permission and no admin consent, which would open every calendar in the tenant. Access is granted in Exchange Online by
//       RBAC for Applications: role "Application Calendars.Read", scoped to the one mailbox.
//   MS_GRAPH_MAILBOX         optional, default avraham@lalum.co
//   LALUM_OUTLOOK_OWNER_ID   optional, created_by for new rows (RLS on lalum_events does not use it)
// Gate: header x-lalum-worker, checked by lalum_verify_worker_key, the key the dispatch worker's cron job already sends.
// verify_jwt is false because pg_cron has no user JWT. ?dry=1 returns the plan's counts and writes nothing.
// Right after setup Graph answers 403 until the Exchange role assignment propagates (30 minutes to 2 hours): such a run is
// logged as not_authorized and writes nothing. Titles never reach the response or the run log, only counts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type GraphEvent, planSync } from "./sync.ts";

const WINDOW_DAYS = 180;
const MAX_PAGES = 20;

class GraphError extends Error {
  constructor(readonly step: "token" | "calendar", readonly status: number) {
    super(`${step} ${status}`);
  }
}

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing secret ${k}`);
  return v;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function graphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${env("MS_GRAPH_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("MS_GRAPH_CLIENT_ID"),
      client_secret: env("MS_GRAPH_CLIENT_SECRET"),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new GraphError("token", res.status);
  return (await res.json()).access_token as string;
}

// calendarView expands recurring series into their occurrences. Immutable ids survive the event moving between folders.
async function fetchEvents(token: string, from: Date, to: Date): Promise<GraphEvent[]> {
  const mailbox = encodeURIComponent(Deno.env.get("MS_GRAPH_MAILBOX") || "avraham@lalum.co");
  const q = new URLSearchParams({
    startDateTime: from.toISOString(),
    endDateTime: to.toISOString(),
    $select: "id,subject,location,start,end,isCancelled,isOnlineMeeting",
    $top: "100",
  });
  let url: string | null = `https://graph.microsoft.com/v1.0/users/${mailbox}/calendarView?${q}`;
  const out: GraphEvent[] = [];
  for (let page = 0; url; page++) {
    if (page === MAX_PAGES) throw new Error("calendar paging did not end");
    const res: Response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' },
    });
    if (!res.ok) throw new GraphError("calendar", res.status);
    const body: { value?: GraphEvent[]; "@odata.nextLink"?: string } = await res.json();
    out.push(...(body.value ?? []));
    url = body["@odata.nextLink"] ?? null;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: keyOk } = await sb.rpc("lalum_verify_worker_key", { p_key: req.headers.get("x-lalum-worker") ?? "" });
  if (keyOk !== true) return json({ ok: false }, 403);

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
  let result: Record<string, unknown>;
  try {
    const fetched = await fetchEvents(await graphToken(), now, windowEnd);
    const { data: existing, error } = await sb.from("lalum_events")
      .select("id, external_id, title, starts_at")
      .eq("source", "outlook")
      .gt("ends_at", now.toISOString());
    if (error) throw new Error(`read lalum_events ${error.code}`);

    const plan = planSync(fetched, existing ?? [], now, windowEnd);
    if (plan.status === "refused") {
      result = { status: "refused", reason: plan.reason, fetched: plan.fetched };
    } else {
      const counts = {
        fetched: plan.fetched,
        skipped: plan.skipped,
        upserts: plan.upserts.length,
        rekeys: plan.rekeys.length,
        deletes: plan.deletes.length,
        held: plan.held,
      };
      if (dry) {
        result = { status: "dry_run", plan: plan.status, ...counts };
      } else {
        const { data, error: applyError } = await sb.rpc("lalum_outlook_apply", {
          p_rows: plan.upserts,
          p_rekeys: plan.rekeys,
          p_delete_ids: plan.deletes,
          p_owner: Deno.env.get("LALUM_OUTLOOK_OWNER_ID") || null,
        });
        if (applyError) throw new Error(`apply ${applyError.code}`);
        result = { status: plan.status, ...counts, applied: data };
      }
    }
  } catch (e) {
    result = e instanceof GraphError
      ? { status: e.step === "calendar" && e.status === 403 ? "not_authorized" : `${e.step}_failed`, http: e.status }
      : { status: "error", message: String((e as Error).message ?? e).slice(0, 200) };
  }

  if (!dry) {
    const { error } = await sb.from("lalum_outlook_sync_runs").insert({ status: String(result.status), detail: result });
    if (error) console.error("run log", error.code);
  }
  return json(result);
});
