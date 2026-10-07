// Originals live in memory only (not stored on the server): they power the PII inspector and the
// name restore on export during this browser session, and vanish on reload.
export interface Original { text: string; entities: Array<{ token: string; kind: string; start: number; end: number }> }
export const originals = new Map<string, Original>();
