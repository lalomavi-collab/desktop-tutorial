// Assembles one document with annexes into a single printable file: a cover page with the index,
// the main document, then each annex behind a divider page. The browser's print dialog turns it into
// a PDF, which is what keeps Hebrew shaping and right to left layout correct (no PDF library, no
// embedded font). Only documents that passed the server side sign-off gate ever reach this code.

const LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];

/** "נספח א׳" for the first annex; past the 22 letters, a number. */
export const annexLabel = (i: number): string => (i < LETTERS.length ? `נספח ${LETTERS[i]}׳` : `נספח ${i + 1}`);

/** A readable title from a stored file name: no extension. */
export const titleOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, "").trim() || "מסמך";

export interface AssemblyItem { title: string; content: string }
export interface Assembly { title: string; dateLabel: string; main: AssemblyItem; annexes: AssemblyItem[] }

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildAssemblyHtml(a: Assembly): string {
  const toc = [
    `<li><span class="lbl">המסמך</span> ${esc(a.main.title)}</li>`,
    ...a.annexes.map((x, i) => `<li><span class="lbl">${annexLabel(i)}</span> ${esc(x.title)}</li>`),
  ].join("");
  const annexes = a.annexes.map((x, i) =>
    `<section class="divider"><div class="big">${annexLabel(i)}</div><div class="sub">${esc(x.title)}</div></section>` +
    `<section class="body">${esc(x.content)}</section>`).join("");
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(a.title)}</title><style>
@page{size:A4;margin:22mm 20mm 24mm;@bottom-center{content:counter(page);font-family:Arial,sans-serif;font-size:10pt}}
body{font-family:David,'Frank Ruhl Libre','Times New Roman',serif;font-size:13pt;line-height:1.8;direction:rtl;margin:0}
section.body{white-space:pre-wrap;text-align:justify;break-before:page}
section.cover{text-align:center;break-after:page}
section.cover h1{font-size:24pt;margin:60mm 0 8mm}
section.cover .date{font-size:12pt;margin-bottom:14mm}
section.cover ul{list-style:none;padding:0;margin:0 auto;max-width:150mm;text-align:right}
section.cover li{padding:3mm 0;border-bottom:1px solid #ccc}
.lbl{display:inline-block;min-width:28mm;font-weight:bold}
section.divider{break-before:page;text-align:center;padding-top:80mm}
section.divider .big{font-size:34pt;font-weight:bold}
section.divider .sub{font-size:16pt;margin-top:8mm}
section.main{white-space:pre-wrap;text-align:justify}
</style></head><body>
<section class="cover"><h1>${esc(a.title)}</h1><div class="date">${esc(a.dateLabel)}</div><ul>${toc}</ul></section>
<section class="main">${esc(a.main.content)}</section>${annexes}
</body></html>`;
}
