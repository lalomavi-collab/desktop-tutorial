// Ethics rules and the daily updates feed.
//
// Both pages read from data files only, so the daily job that keeps them
// current edits JSON and never page code. The feed is not a third store: it is
// the union of the ethics instruments, the AI rulings already in the case law
// corpus, and a small hand-kept list of developments that are neither.
import ethicsData from "../data/ethics.json";
import updatesData from "../data/updates.json";
import { rulings, rulingTitle } from "./rulings";

export type Commentary = { status: "draft" | "approved"; text: string };
export type EthicsPoint = { para: string; text: string; quote?: string; commentary?: Commentary };
export type EthicsSection = { letter: string; heading: string; paragraphs: string; points: EthicsPoint[]; note?: string; commentary?: Commentary };
export type EthicsInstrument = {
  id: string; number: string; title: string; body: string; dateLabel: string; date: string;
  earlier?: string; signedBy?: string; crossCheckUrl?: string; sourceUrl: string; sourceLabel: string; summary: string;
  sections: EthicsSection[];
  rulesCited: { rule: string; asQuotedInOpinion: string }[];
  casesCited: { citation: string; court?: string; date?: string }[];
  commentary: Commentary;
};

export const instruments = (ethicsData as { instruments: EthicsInstrument[] }).instruments;

// Commentary reaches a visitor only once the owner has approved it. A draft
// lives in the data so it can be reviewed, and is never rendered.
export const shown = (c?: Commentary): string => (c && c.status === "approved" && c.text.trim() ? c.text.trim() : "");

export type FeedKind = "ethics" | "ruling" | "development";
export type FeedItem = {
  id: string; date: string; dateLabel: string; kind: FeedKind; title: string; summary: string;
  href: string; external?: boolean; sources?: { label: string; href: string }[];
};

type ManualUpdate = Omit<FeedItem, "kind" | "href"> & { kind?: FeedKind; href?: string };
const manual = (updatesData as { items: ManualUpdate[] }).items;

export function feed(): FeedItem[] {
  const items: FeedItem[] = [];
  for (const i of instruments) {
    items.push({ id: `ethics-${i.id}`, date: i.date, dateLabel: i.dateLabel, kind: "ethics", title: `${i.number}: ${i.title}`, summary: i.summary, href: "/ethics" });
  }
  for (const r of rulings) {
    if (!r.areas.includes("ai")) continue;
    items.push({
      id: `ruling-${r.id}`, date: r.date, dateLabel: r.dateLabel, kind: "ruling",
      title: rulingTitle(r), summary: r.holding.length > 260 ? `${r.holding.slice(0, 257).trimEnd()}...` : r.holding,
      href: `/rulings?q=${encodeURIComponent(r.citation)}`,
    });
  }
  for (const m of manual) {
    const first = m.sources?.[0]?.href;
    items.push({ ...m, kind: m.kind ?? "development", href: m.href ?? first ?? "/updates", external: m.external ?? (!m.href && !!first) });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export const ETHICS_TITLE = "אתיקה ובינה מלאכותית: גילוי דעת עורכי הדין את/60/24 | LALUM";
export const ETHICS_DESC = "גילוי הדעת העדכני של ועדת האתיקה הארצית על שימוש ב-AI בעבודת עורכי הדין, סעיף אחר סעיף, עם הפניה לנוסח הרשמי ולפסיקה שהוא מצטט.";
export const UPDATES_TITLE = "חדשנו: פסיקה והחלטות בתחום AI ומשפט | LALUM";
export const UPDATES_DESC = "פסיקה, גילויי דעת של לשכת עורכי הדין והתפתחויות בתחום הבינה המלאכותית והמשפט, מהחדש לישן, עם קישור למקור של כל פריט.";

export const KIND_LABEL: Record<FeedKind, string> = { ethics: "גילוי דעת", ruling: "פסיקה", development: "התפתחות" };
