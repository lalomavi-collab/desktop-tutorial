// Checks the document type suggestion used by the folder import on a labelled set. Run with: npm run doc-suggest-check.
// The module is transpiled from src/lib/cockpit/docSuggest.ts, so the test runs the shipped code.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/cockpit/docSuggest.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "docsuggest-"));
const file = join(dir, "docSuggest.mjs");
writeFileSync(file, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { suggestDocType, subjectOf } = await import(pathToFileURL(file).href);

// [path inside the matter folder, expected type or null]
const CASES = [
  ["חוזה מכר סופי.docx", "CONTRACT"],
  ["הסכמים/טיוטה 3.docx", "CONTRACT"],
  ["הסכמים/נספחים/נספח א.pdf", "CONTRACT"],
  ["נספח להסכם שכירות.pdf", "CONTRACT"],
  ["כתבי טענות/כתב תביעה מתוקן.docx", "COURT_FILING"],
  ["בית משפט/החלטה מיום 3.pdf", "COURT_FILING"],
  ["תצהיר העד.docx", "COURT_FILING"],
  ["חוות דעת שמאית.pdf", "OPINION"],
  ["שמאות/דוח.pdf", "OPINION"],
  ["התכתבות/מכתב לצד שכנגד.docx", "CORRESPONDENCE"],
  ["מיילים/2025-03-01.html", "CORRESPONDENCE"],
  ["דואר/הודעה ללקוח.txt", "CORRESPONDENCE"],
  ["רשויות/אישור ועדה מקומית.pdf", "AUTHORITY"],
  ["נסח טאבו.pdf", "AUTHORITY"],
  ["ראיות/חשבונית 1042.pdf", "EVIDENCE"],
  ["נספחים/קבלה.pdf", "EVIDENCE"],
  // The file name beats the folder: a letter inside a folder of agreements is still a letter.
  ["הסכמים/מכתב דחייה.docx", "CORRESPONDENCE"],
  // No keyword: no suggestion, so the partner's single answer applies.
  ["סיכום פגישה.docx", null],
  ["כללי/רשימת משימות.txt", null],
  // "הסכמה" is consent, not an agreement.
  ["הסכמה לפרסום.docx", null],
  ["", null],
];
for (const [path, want] of CASES) assert.equal(suggestDocType(path), want, `${path} -> ${want}`);

assert.equal(subjectOf("הסכמים/נספחים/א.pdf"), "הסכמים");
assert.equal(subjectOf("חוזה.docx"), null);
console.log(`doc-suggest-check: ${CASES.length} cases passed`);
