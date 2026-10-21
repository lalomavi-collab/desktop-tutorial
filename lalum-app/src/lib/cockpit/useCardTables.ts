import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Gives every cockpit table the card layout on a phone (the CSS lives under `.ck-cards-table`, below 640px) without
 * rewriting each screen: it reads the header cells and writes each one onto the cells under it as `data-label`, and marks
 * the table. It runs again whenever the screen changes, so a table that loads later, or a row added after a save, is
 * covered too. A table opts out with `data-cards="off"`; a table of more than eight columns keeps its sideways scroll; a table that already carries its own cards (`.rev-table`) is skipped.
 */
export function annotateTables(root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>("table.ck-table"))) {
    if (table.dataset.cards === "off" || table.closest(".rev-table")) continue;
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!headRow) continue;
    const labels: string[] = [];
    for (const th of Array.from(headRow.cells)) {
      const text = (th.textContent ?? "").replace(/\s+/g, " ").trim();
      for (let i = 0; i < Math.max(1, th.colSpan); i++) labels.push(text);
    }
    // A matrix (weeks across, more than eight columns) reads better scrolled sideways than cut into a card per row.
    if (!labels.some(Boolean) || labels.length > 8) continue;
    table.classList.add("ck-cards-table");
    for (const body of Array.from(table.tBodies)) {
      for (const row of Array.from(body.rows)) {
        let col = 0;
        for (const cell of Array.from(row.cells)) {
          const label = cell.colSpan > 1 ? "" : labels[col] ?? "";
          if (label) { if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label); }
          else if (cell.hasAttribute("data-label") && !cell.dataset.labelFixed) cell.removeAttribute("data-label");
          col += Math.max(1, cell.colSpan);
        }
      }
    }
  }
}

export function useCardTables(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const run = () => { frame = 0; annotateTables(el); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [ref]);
}
