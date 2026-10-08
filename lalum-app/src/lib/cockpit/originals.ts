// Originals live in memory only (not stored on the server): they power the PII inspector and the
// name restore on export during this browser session, and vanish on reload.
export interface Original { text: string; entities: Array<{ token: string; kind: string; start: number; end: number }> }
export const originals = new Map<string, Original>();

export const TOKEN_RE = /\[[A-Z_]+_\d+\]/g;

/** token to original text for one document, or null when the session does not hold its original. */
export function tokenMap(docId: string): Map<string, string> | null {
  const o = originals.get(docId);
  if (!o) return null;
  const m = new Map<string, string>();
  for (const e of o.entities) if (!m.has(e.token)) m.set(e.token, o.text.slice(e.start, e.end));
  return m;
}

export const restore = (text: string, map: Map<string, string>): string => text.replace(TOKEN_RE, (t) => map.get(t) ?? t);
