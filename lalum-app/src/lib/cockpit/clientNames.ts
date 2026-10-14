// Pure rules for showing client names on screen (see migration 0044). Kept free of React so scripts/client-names-check.mjs tests the shipped code.
export interface Named { matter_code?: string | null; title?: string | null }

/** Hidden: the matter code. Revealed: the title (falling back to the code when there is none). Never throws, never returns an empty label. */
export function displayName(revealed: boolean, m: Named | null | undefined): string {
  const code = m?.matter_code?.trim() || "";
  const title = m?.title?.trim() || "";
  if (revealed) return title || code || "תיק";
  return code || "תיק";
}

/** Search may only match what the user can see: the code while hidden, the title (and code) once revealed. */
export function matchesQuery(revealed: boolean, m: Named, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((m.matter_code ?? "").toLowerCase().includes(q)) return true;
  return revealed && (m.title ?? "").toLowerCase().includes(q);
}

/** Names go back into hiding after this much time without interaction. */
export const REVEAL_IDLE_MS = 5 * 60 * 1000;
export const idleExpired = (lastActivity: number, now: number, ttl: number = REVEAL_IDLE_MS): boolean => now - lastActivity >= ttl;
