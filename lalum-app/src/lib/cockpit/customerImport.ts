// Reading a customer list that arrives as pasted text, a CSV file or a spreadsheet, and checking it before anything is saved.
// Pure functions, no browser objects, so they run in the node checks (npm run finance-check).
import { customerProblems } from "./finance.ts";

export type ImportCustomer = { name: string; tax_id: string; email: string; phone: string; address: string; city: string };
export type ImportStatus = "new" | "duplicate" | "invalid";
export type ImportRow = ImportCustomer & { status: ImportStatus; problems: string[]; gaps: string[] };

const FIELDS: Array<keyof ImportCustomer> = ["name", "tax_id", "email", "phone", "address", "city"];
// Header words people actually use, Hebrew and English. A cell is matched whole, after trimming punctuation.
const HEADERS: Record<keyof ImportCustomer, string[]> = {
  name: ["שם", "שם לקוח", "שם הלקוח", "לקוח", "name", "customer", "customer name", "client"],
  tax_id: ["ת.ז", "תז", "ת.ז.", "ח.פ", "חפ", "ח.פ.", "ת.ז / ח.פ", "ת.ז. / ח.פ.", "ת.ז/ח.פ", "מספר זהות", "מספר עוסק", "ע.מ", "עוסק", "id", "tax id", "tax_id", "vat id"],
  email: ["דוא\"ל", "דואל", "מייל", "אימייל", "אי-מייל", "כתובת מייל", "כתובת דוא\"ל", "email", "e-mail", "mail"],
  phone: ["טלפון", "נייד", "טלפון נייד", "פלאפון", "phone", "mobile", "tel"],
  address: ["כתובת", "רחוב", "address", "street"],
  city: ["עיר", "יישוב", "city"],
};
const norm = (s: string) => s.replace(/[‎‏"'׳״]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const HEADER_LOOKUP = new Map<string, keyof ImportCustomer>(
  (Object.entries(HEADERS) as Array<[keyof ImportCustomer, string[]]>).flatMap(([k, ws]) => ws.map((w) => [norm(w), k] as [string, keyof ImportCustomer])),
);

/** Splits one line on the separator, keeping quoted cells whole ("Cohen, Dan" stays one cell). */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    // A quote opens a quoted cell only at the start of a cell; inside a word (דוא"ל, בע"מ) it is an ordinary character.
    if (c === '"' && q) { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
    else if (c === '"' && cur === "") q = true;
    else if (c === sep && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Pasted or CSV text to rows of cells. The separator is the one used most on the first lines: tab (pasted from Excel), semicolon or comma. */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const head = lines.slice(0, 5).join("\n");
  const count = (ch: string) => head.split(ch).length - 1;
  const sep = ([["\t", count("\t")], [";", count(";")], [",", count(",")]] as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0];
  return lines.map((l) => (sep[1] > 0 ? splitLine(l, sep[0]) : [l.trim()]));
}

const taxClean = (s: string) => s.replace(/[\s\-.]/g, "");
export const nameKey = (s: string) => s.replace(/["'׳״]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Cells to customers. If the first row names its columns, those names decide the order; otherwise the order is
 * name, tax id, email, phone, address, city. Each row is marked new, a duplicate of an existing customer (same tax id,
 * or the same name when there is no tax id) or of an earlier row in the file, or invalid.
 */
export function mapCustomers(cells: string[][], existing: Array<{ name: string; tax_id: string | null }>): { rows: ImportRow[]; usedHeader: boolean } {
  if (!cells.length) return { rows: [], usedHeader: false };
  const first = cells[0].map((c) => HEADER_LOOKUP.get(norm(c)));
  const usedHeader = first.filter(Boolean).length >= 2 && first.includes("name");
  const order: Array<keyof ImportCustomer | undefined> = usedHeader ? first : FIELDS;
  const data = usedHeader ? cells.slice(1) : cells;
  const seenTax = new Set(existing.map((c) => c.tax_id).filter((x): x is string => !!x));
  const seenName = new Set(existing.map((c) => nameKey(c.name)));
  const rows: ImportRow[] = [];
  for (const r of data) {
    if (r.every((c) => !c.trim())) continue;
    const row: ImportCustomer = { name: "", tax_id: "", email: "", phone: "", address: "", city: "" };
    order.forEach((k, i) => { if (k && r[i] !== undefined && !row[k]) row[k] = r[i].trim(); });
    row.tax_id = taxClean(row.tax_id);
    // Excel stores a phone number as a number and drops the leading zero (50-1234567 becomes 501234567).
    if (/^5\d{8}$/.test(row.phone.replace(/[\s\-]/g, ""))) row.phone = "0" + row.phone.replace(/[\s\-]/g, "");
    const problems = customerProblems({ name: row.name, email: row.email, tax_id: row.tax_id, i4u: "", casual: false, isNew: false, requireEmail: false });
    // A pasted list may lack addresses: the row is listed with a gap, and issuing to that customer stays blocked until the card has one.
    const gaps = [...(row.email ? [] : ['דוא"ל']), ...(row.tax_id ? [] : ["ת.ז. או ח.פ."])];
    let status: ImportStatus = "new";
    if (problems.length) status = "invalid";
    else if (row.tax_id ? seenTax.has(row.tax_id) : seenName.has(nameKey(row.name))) status = "duplicate";
    if (status === "new") { if (row.tax_id) seenTax.add(row.tax_id); seenName.add(nameKey(row.name)); }
    rows.push({ ...row, status, problems, gaps });
  }
  return { rows, usedHeader };
}

/** A starter file the user can fill in and upload again. Excel opens a CSV with a byte order mark as UTF-8, so Hebrew survives. */
export const CUSTOMER_TEMPLATE_CSV = "﻿שם,ת.ז. / ח.פ.,דוא\"ל,טלפון,כתובת,עיר\r\nישראל ישראלי,123456789,israel@example.com,050-0000000,הרצל 1,תל אביב\r\n";
