// Request handling for the Microsoft Graph change notification webhook. No Deno APIs: the real ports are wired in index.ts and
// the test wires fakes. The handler is read only toward the mailbox, never sends, and never writes message content anywhere.
import { messageKey, routeMessage, sha256Hex, type Decision, type MatterInfo, type Message } from "./route.ts";

export interface MessageMeta extends Message { internetMessageId: string; conversationId: string | null; receivedAt: string }
export interface IntakeRow {
  firmId: string; messageKey: string; conversationKey: string | null; receivedAt: string; decision: Decision;
}
export interface Ports {
  clientState: string;
  aliasDomains: string[];
  firmId: string;
  fetchMeta(graphMessageId: string): Promise<MessageMeta | null>;
  lookupMatterByCode(code: string): Promise<MatterInfo | undefined>;
  lookupThread(firmId: string, conversationKey: string): Promise<MatterInfo | null>;
  recordIntake(row: IntakeRow): Promise<"inserted" | "duplicate">;
  /** Copies the message into the vault and the matter. Not wired yet: the row then stays QUEUED, visible and retryable. */
  fileMessage?(row: IntakeRow, graphMessageId: string): Promise<boolean>;
  markFiled?(firmId: string, messageKey: string): Promise<void>;
  log(event: string, data: Record<string, string | number>): void;
}
export interface Summary { received: number; rejected: number; duplicates: number; queued: number; triage: number; hold: number; filed: number; unreadable: number }

// Constant time, so the shared secret is not leaked through timing.
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

interface Notification { clientState?: string; resourceData?: { id?: string }; changeType?: string }

export async function handleRequest(req: Request, ports: Ports): Promise<Response> {
  const url = new URL(req.url);
  // Subscription validation handshake: echo the token as plain text.
  const token = url.searchParams.get("validationToken");
  if (token) return new Response(token, { status: 200, headers: { "content-type": "text/plain" } });
  if (req.method !== "POST") return new Response(null, { status: 405 });
  let body: { value?: Notification[] };
  try { body = await req.json(); } catch { return new Response(null, { status: 400 }); }
  const items = Array.isArray(body.value) ? body.value : [];
  const summary: Summary = { received: items.length, rejected: 0, duplicates: 0, queued: 0, triage: 0, hold: 0, filed: 0, unreadable: 0 };
  for (const n of items) {
    if (typeof n.clientState !== "string" || !same(n.clientState, ports.clientState)) { summary.rejected++; continue; }
    const id = n.resourceData?.id;
    if (!id || n.changeType !== "created") { summary.unreadable++; continue; }
    const meta = await ports.fetchMeta(id);
    if (!meta) { summary.unreadable++; continue; }
    const key = await messageKey(meta.internetMessageId);
    const conv = meta.conversationId ? await sha256Hex(meta.conversationId) : null;
    const codes = new Map<string, MatterInfo | undefined>();
    for (const c of [...new Set([...meta.to, ...meta.cc, meta.subject].flatMap((s) => s.match(/L-\d{4}-\d{4}/gi) ?? []))]) {
      const u = c.toUpperCase();
      codes.set(u, await ports.lookupMatterByCode(u));
    }
    const thread = conv ? await ports.lookupThread(ports.firmId, conv) : null;
    const decision = routeMessage(meta, { aliasDomains: ports.aliasDomains, matterByCode: (c) => codes.get(c.toUpperCase()), threadMatter: thread });
    const row: IntakeRow = { firmId: ports.firmId, messageKey: key, conversationKey: conv, receivedAt: meta.receivedAt, decision };
    if ((await ports.recordIntake(row)) === "duplicate") { summary.duplicates++; continue; }
    if (decision.state === "TRIAGE") summary.triage++;
    else if (decision.state === "CONFLICT_HOLD") summary.hold++;
    else {
      summary.queued++;
      if (ports.fileMessage && (await ports.fileMessage(row, id))) { await ports.markFiled?.(ports.firmId, key); summary.filed++; }
    }
  }
  // Counts only: never a subject, an address or an id of the message.
  ports.log("intake", { ...summary });
  if (items.length > 0 && summary.rejected === items.length) return new Response(null, { status: 401 });
  return new Response(JSON.stringify(summary), { status: 202, headers: { "content-type": "application/json" } });
}
