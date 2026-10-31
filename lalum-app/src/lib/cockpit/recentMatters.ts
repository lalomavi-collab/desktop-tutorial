// The matters opened last on this browser, newest first, for the "recently viewed" row of the entry gate (owner, 31.10.2026,
// after Clio's home screen). Only matter ids are kept, never a title or a client name: the label is read from the database
// under the member's own access and masked like every other matter label, so nothing identifying lives in browser storage.
const KEY = "ck-recent-matters";
const MAX = 8;
const UUID = /^[0-9a-f-]{36}$/i;

export function recentMatterIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX) : [];
  } catch { return []; }
}

export function rememberMatter(id: string): void {
  if (!UUID.test(id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([id, ...recentMatterIds().filter((x) => x !== id)].slice(0, MAX))); } catch { /* storage blocked */ }
}
