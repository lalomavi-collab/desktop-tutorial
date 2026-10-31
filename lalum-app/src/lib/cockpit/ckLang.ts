import { useLang } from "../../context/LangContext";

// The language of the system (owner, 31.10.2026: a language choice on every page, as the EN switch in the top bar of
// the legal AI apps he compared). The system speaks Hebrew and English; it rides on the site's own language state,
// so a choice made on the site carries into the system and back, and <html lang/dir> stays true. The other site
// languages read the system in English (Arabic, right to left like Hebrew, reads it in Hebrew).
export type CkLang = "he" | "en";

export interface CkLangValue {
  lang: CkLang;
  dir: "rtl" | "ltr";
  setLang: (l: CkLang) => void;
  /** The Hebrew text or its English counterpart, by the current language. */
  tx: (he: string, en: string) => string;
  /** The locale for dates and numbers. */
  locale: "he-IL" | "en-GB";
}

export function ckLangOf(siteLang: string): CkLang {
  return siteLang === "he" || siteLang === "ar" ? "he" : "en";
}

export function useCkLang(): CkLangValue {
  const { lang, setLang } = useLang();
  const ck = ckLangOf(lang);
  return {
    lang: ck,
    dir: ck === "he" ? "rtl" : "ltr",
    setLang: (l) => { if (l !== ck) setLang(l); },
    tx: (he, en) => (ck === "he" ? he : en),
    locale: ck === "he" ? "he-IL" : "en-GB",
  };
}

// The rail, by route. Hebrew stays in the frame beside each item; this is its English.
export const NAV_EN: Record<string, string> = {
  "/workspace/dashboard": "Dashboard",
  "/workspace/control": "Control room",
  "/workspace": "Matters",
  "/workspace/inquiries": "Client inquiries",
  "/workspace/calls": "Incoming calls",
  "/workspace/inbox": "Message inbox",
  "/workspace/client-docs": "Client documents",
  "/workspace/kyc": "Know your client",
  "/workspace/tasks": "Tasks",
  "/workspace/scheduling": "Calendar and meetings",
  "/workspace/hours": "Work hours",
  "/workspace/scorecard": "Service metrics",
  "/workspace/import": "Import matters",
  "/admin/matters": "Matter administration",
  "/workspace/payments": "Client billing",
  "/workspace/discussions": "Public discussions",
  "/workspace/campaigns": "Campaigns",
  "/workspace/partner": "Partner view",
  "/workspace/portal-preview": "Portal preview",
  "/settings/members": "Firm members",
  "/settings/billing": "Billing and settings",
  "/settings/security": "Security",
  "/workspace/export": "Data export",
  "/workspace/bin": "Recycle bin",
  "/workspace/guide": "Guide",
};

export const NAV_HEADING_EN: Record<string, string> = {
  "לקוחות ופניות": "Clients and inquiries",
  "עבודת הפירמה": "Firm work",
  "גבייה ותוכן": "Billing and content",
  "שותפים": "Partners",
  "הגדרות": "Settings",
  "כללי": "General",
};

// Every framed screen's title and the line under it, in English. A screen not listed keeps its Hebrew title.
export const SCREEN_EN: Record<string, [string, string]> = {
  "/settings/security": ["Account security", "Change the password, and turn on and manage two factor sign in for the account."],
  "/settings/billing": ["Firm billing and settings", "The firm's finances: tax documents, customers, expenses and reports. On the second tab: the firm's plan, user seats and the automatic intake connection."],
  "/workspace/inbox": ["Message inbox", "Client messages grouped by client, with a drafted reply and sending."],
  "/workspace/control": ["Control room", "One picture of every area: finance, matters, content and marketing, infrastructure and security. Each tile carries a status, a number where it can be trusted, and an explanation that opens."],
  "/workspace/dashboard": ["Dashboard", "The state of the firm's matters, inquiries and tasks."],
  "/admin/matters": ["Matter administration", "The administrator's board: every matter, live SLA metrics and the conflict check audit log."],
  "/settings/members": ["Firm members", "The firm's team, roles and permissions: who sees which matters, by assignment and department."],
  "/workspace/portal-preview": ["Client portal preview", "This is how the client sees the matter."],
  "/workspace/campaigns": ["Campaigns", "The Legal AI campaign in one place: Google, site visits, campaign pages, the funnel to a meeting, Facebook, Instagram and LinkedIn, paid media and connection status. Updated twice a day."],
  "/workspace/import": ["Import matters from a folder", "Create matters from the firm's working folder."],
  "/workspace/hours": ["Work hours", "Clock in, a timer per matter and time entries. For partners: attendance against recorded hours against billable hours, for every lawyer and every matter."],
  "/workspace/client-docs": ["Client documents", "Every file the clients uploaded, in a folder per client, downloaded one by one or as a zip."],
  "/workspace/export": ["Firm data export", "A verified handover package of all the firm's data."],
  "/workspace/payments": ["Client billing", "Issue payment requests to clients, copy the payment link and follow the collection status."],
  "/workspace/scheduling": ["Calendar and meetings", "Plan the firm's working week: events, free time and scheduling tasks."],
  "/workspace/discussions": ["Public discussions", "Approve questions from the public panel on the real estate and AI pages before they appear on the site."],
  "/workspace/calls": ["Incoming calls", "Calls handled by the voice agent, grouped by caller, with a summary, a task and billing in one click."],
  "/workspace": ["Matters", "The LALUM matter cockpit: a vault, a smart editor and a studio of practice agents with human approval before export."],
  "/workspace/bin": ["Recycle bin", "Matters and documents moved to the bin, with restore and permanent deletion."],
  "/workspace/matter-360": ["Matter 360", "Everything happening around the matter."],
  "/workspace/partner": ["Partner view", "Financial metrics, cash flow and exceptions."],
  "/workspace/kyc": ["Know your client", "Know your client documentation across all the firm's matters. A control record only, with no identifying details."],
  "/workspace/inquiries": ["Client inquiries", "Client inquiries that reached the matters."],
  "/workspace/tasks": ["Tasks", "Open tasks in the matters."],
  "/workspace/scorecard": ["Service metrics", "Response times and tasks met on time."],
};

// The screens whose content is written in English too. Until a screen is here, its content keeps reading in Hebrew,
// right to left, under an English frame: the site's own rule for pages that have no translation.
export const TRANSLATED_SCREENS = new Set<string>([]);

export const PRACTICE_EN: Record<string, string> = {
  REAL_ESTATE: "Real estate / TAMA 38",
  COMMERCIAL_MA: "Commercial / M&A",
  LABOR_LAW: "Labour law",
  AI_GOVERNANCE: "AI governance",
  LITIGATION: "Litigation",
};

export const LOOK_EN: Record<string, string> = { navy: "Navy", beige: "Beige", dark: "Dark" };
