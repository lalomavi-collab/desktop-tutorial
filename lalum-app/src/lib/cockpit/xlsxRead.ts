// Reads the first sheet of an .xlsx file as rows of text cells. An .xlsx is a zip of XML files; this reads only the
// shared strings and the first worksheet, which is all a customer list needs. Formulas are read as their cached value.
import JSZip from "jszip";

const colIndex = (ref: string): number => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const text = (el: Element | null | undefined) => Array.from(el?.getElementsByTagName("t") ?? []).map((t) => t.textContent ?? "").join("");

export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetName = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10))[0];
  if (!sheetName) throw new Error("no worksheet");
  const shared: string[] = [];
  const ss = zip.file("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(xml(await ss.async("string")).getElementsByTagName("si"))) shared.push(text(si));
  const doc = xml(await zip.files[sheetName].async("string"));
  const out: string[][] = [];
  for (const row of Array.from(doc.getElementsByTagName("row"))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const at = c.getAttribute("r");
      const i = at ? colIndex(at) : cells.length;
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      cells[i] = t === "s" ? (shared[Number(v)] ?? "") : t === "inlineStr" ? text(c) : v;
    }
    out.push(Array.from(cells, (x) => x ?? ""));
  }
  return out;
}
