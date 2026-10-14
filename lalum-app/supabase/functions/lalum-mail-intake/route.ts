// Mail routing for the case folder link (docs/matter-folder-sync-design.md, section 5). Pure: no network, no database, no
// Deno APIs, so the test runs the shipped code. It decides where one incoming message goes and never looks at a body.
// A message is filed only on a deterministic match: a matter code in a recipient address (cases+L-2026-0011@lalum.co), a
// matter code in the subject ([L-2026-0011]), or a conversation that is already filed to one matter. Sender, name and any
// guess from content never decide. Everything unclear goes to the triage queue for a person.
export type Route = "ALIAS" | "SUBJECT_CODE" | "THREAD" | null;
export type State = "QUEUED" | "TRIAGE" | "CONFLICT_HOLD";
export type Reason = "NO_MATCH" | "AMBIGUOUS" | "UNKNOWN_CODE" | "MATTER_NOT_ENABLED" | "MATTER_CLOSED" | null;

export interface MatterInfo { id: string; syncEnabled: boolean; status: string; conflictStatus: string }
export interface Message { to: string[]; cc: string[]; subject: string }
export interface Lookups {
  aliasDomains: string[];
  matterByCode(code: string): MatterInfo | undefined;
  threadMatter: MatterInfo | null;
}
export interface Decision { state: State; route: Route; reason: Reason; matterId: string | null }

const CODE = /L-\d{4}-\d{4}/gi;
const ALIAS = /^cases\+(l-\d{4}-\d{4})@([^@\s]+)$/i;

export function aliasCodes(addresses: string[], domains: string[]): string[] {
  const ok = new Set(domains.map((d) => d.toLowerCase()));
  const out: string[] = [];
  for (const a of addresses) {
    const m = ALIAS.exec(a.trim().replace(/^.*<|>$/g, ""));
    if (m && ok.has(m[2].toLowerCase())) out.push(m[1].toUpperCase());
  }
  return out;
}

export function subjectCodes(subject: string): string[] {
  // Only a code in square brackets counts: a bare "L-2026-0011" inside a sentence is not a routing instruction.
  const out: string[] = [];
  for (const m of subject.matchAll(/\[\s*(L-\d{4}-\d{4})\s*\]/gi)) out.push(m[1].toUpperCase());
  return out;
}

export function routeMessage(msg: Message, look: Lookups): Decision {
  const triage = (reason: Reason): Decision => ({ state: "TRIAGE", route: null, reason, matterId: null });
  const alias = aliasCodes([...msg.to, ...msg.cc], look.aliasDomains);
  const subject = subjectCodes(msg.subject);
  const found = new Map<string, { m: MatterInfo; route: Exclude<Route, null> }>();
  for (const [codes, route] of [[alias, "ALIAS"], [subject, "SUBJECT_CODE"]] as const) {
    for (const c of codes) {
      const m = look.matterByCode(c);
      if (!m) return triage("UNKNOWN_CODE");
      if (!found.has(m.id)) found.set(m.id, { m, route });
    }
  }
  if (look.threadMatter && !found.has(look.threadMatter.id)) found.set(look.threadMatter.id, { m: look.threadMatter, route: "THREAD" });
  if (found.size === 0) return triage("NO_MATCH");
  if (found.size > 1) return triage("AMBIGUOUS");
  const { m, route } = [...found.values()][0];
  const base = { route, matterId: m.id };
  if (m.status === "ARCHIVED") return { state: "TRIAGE", reason: "MATTER_CLOSED", ...base };
  if (!m.syncEnabled) return { state: "TRIAGE", reason: "MATTER_NOT_ENABLED", ...base };
  if (m.conflictStatus === "DIRECT_CONFLICT") return { state: "CONFLICT_HOLD", reason: null, ...base };
  return { state: "QUEUED", reason: null, ...base };
}

// Stable, content free keys. The Internet Message-ID and the conversation id are hashed before they are stored or logged.
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const messageKey = (internetMessageId: string) => sha256Hex(internetMessageId.trim().replace(/^<|>$/g, "").toLowerCase());
