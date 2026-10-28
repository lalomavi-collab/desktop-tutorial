// lalum-fin-bank-sync: Supabase Edge Function (Deno), deployed with verify_jwt off (the gate below does its own check). pg_cron calls it
// twice a day (migration 20261028143200); it reads the firm's business account through the Financy API (Open-Finance LTD) and writes
// its new lines and its booked balance through lalum_fin_bank_sync_apply (20261028143000), which also reconciles them against the
// issued documents and the expenses. The control room's cash tile reads the result through the snapshot (20261028143100).
//
// Secrets (the owner pastes them into the Supabase function secrets; never in the repo, never in chat). Without them every run is
// logged as not_configured and nothing is read or written:
//   FINANCY_CLIENT_ID, FINANCY_CLIENT_SECRET, FINANCY_USER_ID   from the Financy app, Settings, API access. Financy has no read only
//       key: these credentials can also start a payment. This function never does. It sends one POST, for the token, and otherwise
//       GET on three lists only (readUrl in map.ts refuses any other path): no refresh (20 credits each), no payment, no write.
// Gate: header x-lalum-worker, checked by lalum_verify_worker_key, the key the other cron jobs send. ?dry=1 reads and plans but writes
// nothing (no link, no line, no run row) and returns counts.
// Only a firm account linked to a Financy account is read past its type (see planLinks): the owner's private accounts and cards stay
// out of the firm's books. The run row holds counts and states, never an amount, a description or a name, and the token never
// leaves this function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type FirmAccount, type FxAccount, type FxConnection, type FxTransaction,
  TOKEN_URL, connectionState, dataAt, israelDay, mapTransactions, pickBalance, planLinks, readUrl, windowFrom, worst,
} from "./map.ts";

const PAGE = 200;
const MAX_PAGES = 50;
const TIMEOUT_MS = 20_000;

class FxError extends Error {
  constructor(readonly step: string, readonly status: number) {
    super(`${step} ${status}`);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function token(id: string, secret: string, userId: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: id, clientSecret: secret, userId }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new FxError("token", res.status);
  const body = await res.json();
  if (typeof body?.accessToken !== "string") throw new FxError("token", 0);
  return body.accessToken;
}

/** Every page of one of the three lists. The cursor goes back as nextPage until it comes back empty. */
async function list<T>(tok: string, step: string, path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; ; page++) {
    if (page === MAX_PAGES) throw new FxError(`${step}_paging`, 0);
    const q = new URLSearchParams(params);
    if (cursor) q.set("nextPage", cursor);
    const res = await fetch(readUrl(`${path}?${q}`), {
      method: "GET",
      headers: { authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new FxError(step, res.status);
    const body: { items?: T[]; nextPage?: string | null } = await res.json();
    out.push(...(Array.isArray(body.items) ? body.items : []));
    cursor = typeof body.nextPage === "string" && body.nextPage !== "" ? body.nextPage : null;
    if (!cursor) return out;
  }
}

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: keyOk } = await sb.rpc("lalum_verify_worker_key", { p_key: req.headers.get("x-lalum-worker") ?? "" });
  if (keyOk !== true) return json({ ok: false }, 403);

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const today = israelDay(new Date());
  const [id, secret, userId] = ["FINANCY_CLIENT_ID", "FINANCY_CLIENT_SECRET", "FINANCY_USER_ID"].map((k) => Deno.env.get(k) ?? "");
  let result: Record<string, unknown>;
  try {
    if (!id || !secret || !userId) {
      result = { status: "not_configured" };
    } else {
      const tok = await token(id, secret, userId);
      const conns = await list<FxConnection>(tok, "connections", "/v2/connections", { limit: "50" });
      const accounts = await list<FxAccount>(tok, "accounts", "/v2/data/accounts", {});
      const { data: firmRows, error } = await sb.from("lalum_fin_bank_accounts")
        .select("id, bank_code, account_last4, currency, is_active, provider, provider_account_id, sync_from");
      if (error) throw new Error(`read accounts ${error.code}`);
      const plan = planLinks(accounts, (firmRows ?? []) as FirmAccount[]);

      const work = [...plan.linked, ...plan.link];
      const states: string[] = plan.missing.map(() => "account_missing");
      if (!work.length) states.push("not_linked");
      const per: Record<string, unknown>[] = [];
      for (const { firm, fx } of work) {
        let syncFrom = firm.sync_from;
        if (!firm.provider) {
          if (dry) {
            syncFrom ??= today;
          } else {
            const { data, error: linkError } = await sb.rpc("lalum_fin_bank_sync_link", { p_account: firm.id, p_provider_account_id: fx.id });
            if (linkError) throw new Error(`link ${linkError.code}`);
            syncFrom = data as string;
          }
        }
        const { data: last } = await sb.from("lalum_fin_bank_lines").select("value_date")
          .eq("bank_account_id", firm.id).eq("source", "financy").order("value_date", { ascending: false }).limit(1);
        const from = windowFrom(syncFrom ?? today, last?.[0]?.value_date ?? null);
        const items = await list<FxTransaction>(tok, "transactions", "/v2/data/transactions",
          { accountId: fx.id as string, dateFrom: from, dateTo: today, limit: String(PAGE), sort: "1" });
        const { lines, skipped } = mapTransactions(items, firm.currency || "ILS");
        const balance = pickBalance(fx, today);
        states.push(connectionState(conns.find((c) => c.id === fx.connectionId)));
        const row: Record<string, unknown> = { account: firm.id, linked_now: !firm.provider, from, fetched: items.length, skipped, balance: !!balance };
        if (!dry) {
          const { data, error: applyError } = await sb.rpc("lalum_fin_bank_sync_apply", { p_account: firm.id, p_lines: lines, p_balance: balance });
          if (applyError) throw new Error(`apply ${applyError.code}`);
          Object.assign(row, { applied: data });
        }
        per.push(row);
      }
      result = {
        status: worst(states),
        data_at: dataAt(conns, work.map((w) => w.fx)),
        accounts: per,
        other: plan.other,
        ...(dry ? { dry_run: true } : {}),
      };
    }
  } catch (e) {
    result = e instanceof FxError
      ? { status: e.step === "token" ? "token_failed" : `${e.step}_failed`, http: e.status }
      : { status: "error", message: String((e as Error).message ?? e).slice(0, 200) };
  }

  if (!dry) {
    const { error } = await sb.from("lalum_fin_bank_sync_runs").insert({ status: String(result.status), detail: result });
    if (error) console.error("run log", error.code);
  }
  return json(result);
});
