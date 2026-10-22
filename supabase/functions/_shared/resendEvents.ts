// Pure helpers for the mail provider's webhook (lalum-fin-doc-send-webhook): signature check and event mapping. No Deno or network APIs
// here (only the standard Web Crypto), so lalum-app/scripts/doc-send-check.mjs can run them under node.

/** The only events the send log records. Everything else the provider sends is acknowledged and ignored. */
export const TRACKED_EVENTS = ["email.delivered", "email.opened", "email.bounced", "email.complained"] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const b64decode = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64encode = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b)));
const equal = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export interface SvixHeaders { id: string | null; timestamp: string | null; signature: string | null }

/**
 * Verifies a Svix style signature (what Resend webhooks use): HMAC SHA256 over "id.timestamp.body" with the secret's base64 part, compared
 * against every "v1,<signature>" in the header, and the timestamp must be within the tolerance so an old capture cannot be replayed.
 * The body must be the raw text exactly as received.
 */
export async function verifySvix(secret: string, h: SvixHeaders, rawBody: string, nowSec: number, toleranceSec = 300): Promise<boolean> {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  let key: Uint8Array;
  try { key = b64decode(secret.startsWith("whsec_") ? secret.slice(6) : secret); } catch { return false; }
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64encode(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${h.id}.${h.timestamp}.${rawBody}`)));
  return h.signature.split(" ").some((part) => {
    const [v, sig] = part.split(",");
    return v === "v1" && !!sig && equal(sig, expected);
  });
}

export interface MappedEvent { ref: string; event: TrackedEvent; at: string }

/** The send log entry an event belongs to, or null when the event is not tracked or has no message id or time. */
export function mapEvent(payload: unknown): MappedEvent | null {
  const p = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!p || typeof p.type !== "string" || !(TRACKED_EVENTS as readonly string[]).includes(p.type)) return null;
  const data = p.data !== null && typeof p.data === "object" ? (p.data as Record<string, unknown>) : null;
  const ref = data && typeof data.email_id === "string" ? data.email_id : "";
  if (!ref || ref.length > 200) return null;
  const at = [p.created_at, data?.created_at].find((v) => typeof v === "string" && !Number.isNaN(Date.parse(v))) as string | undefined;
  if (!at) return null;
  return { ref, event: p.type as TrackedEvent, at: new Date(at).toISOString() };
}
