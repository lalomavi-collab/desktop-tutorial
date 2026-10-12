// Browsers only let a page open a window while it is handling the user's click. A window opened after
// an await (waiting for the server) is classified as not user initiated and is blocked, most often on
// Safari and iOS and always once the wait outlasts the browser's activation window. So the window is
// opened first, synchronously, with a short Hebrew notice in it, and the document is written into it
// when it is ready. Callers close it when the work fails.

const NOTICE = "מכין את המסמך...";

export function openPendingWindow(): Window | null {
  const w = window.open("", "_blank");
  if (!w) return null;
  try {
    w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${NOTICE}</title></head><body style="font-family:Arial,sans-serif;padding:2em">${NOTICE}</body></html>`);
    w.document.close();
  } catch { /* a window we cannot write to is still usable as a target */ }
  return w;
}

/** Writes the finished html into the pending window and opens the print dialog. False if the user closed it. */
export function printInto(w: Window, html: string): boolean {
  if (w.closed) return false;
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
  window.setTimeout(() => { if (!w.closed) w.print(); }, 300);
  return true;
}

export const BLOCKED = "הדפדפן חסם את חלון ההדפסה. אשרו חלונות קופצים לאתר ונסו שוב.";
