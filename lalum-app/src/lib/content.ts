// Shared types for the bilingual content dictionary (see strings.ts).

export type IconName =
  | "scale"
  | "gavel"
  | "shield"
  | "brain"
  | "file"
  | "folder"
  | "book"
  | "spark"
  | "search"
  | "settings"
  | "quote"
  | "check"
  | "compass"
  | "home";

export type Row = { icon: IconName; title: string; sub: string; tag: string };
export type Pillar = { icon: IconName; tag: string; title: string; body: string };
export type PracticeArea = { icon: IconName; tag: string; title: string; blurb: string; points: string[] };
export type StrategyStep = { title: string; body: string };
export type StrategyPath = { id: string; icon: IconName; label: string; tagline: string; steps: StrategyStep[] };
export type RiskVector = { title: string; body: string };
export type RiskType = { id: string; icon: IconName; label: string; vectors: RiskVector[] };
export type RiskStage = { id: string; label: string; level: string; tone: "ok" | "warn" | "high"; note: string };
export type FaqQA = { q: string; a: string };
export type FaqCat = { id: string; title: string; items: FaqQA[] };
export type HubItem = { id: string; area: string; title: string; summary: string; tags: string[]; detail: string[] };
export type Framework = { code: string; title: string; icon: IconName; body: string };
export type Why = { icon: IconName; title: string; body: string };
export type Faq = { q: string; a: string };
export type Service = { icon: IconName; title: string; body: string };
export type Module = { icon: IconName; title: string; body: string };
// Anonymous, detailed engagement scenarios (no invented names, quotes, or
// logos): sector, the challenge, what we did, and the outcome. Stronger and more
// honest than an unattributed testimonial for Enterprise positioning.
export type Testimonial = { sector: string; challenge: string; work: string; outcome: string };
export type Plan = {
  name: string;
  tagline: string;
  best: string;
  popular: boolean;
  features: string[];
  cta: string;
};
export type Audience = { icon: IconName; title: string; body: string; points: string[] };

// A homepage "which one are you?" path: a named audience, a one-line value, and
// a link to where that audience is served.
// One audience on the home page router. The rubrics are the point: a visitor
// who says who they are gets four entries written for them, each pointing at a
// page that already exists, instead of one card pointing at the practice hub.
export type AudienceRubric = { label: string; body: string; to: string };
export type AudiencePath = {
  icon: IconName;
  label: string;
  body: string;
  rubrics: AudienceRubric[];
  cta: string;
  to: string;
};
export type Format = { meta: string; title: string; body: string };

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "cta"; text: string; to: string };

export type Article = {
  slug: string;
  icon: IconName;
  category: string;
  title: string;
  dek: string;
  date: string;
  read: string;
  blocks: ArticleBlock[];
};

// Single primary inbox for the whole app. Both marketing surfaces and the
// training pages route here so nothing points at an unconfigured address.
export const contactEmail = "avraham@lalum.co";
export const trainingEmail = contactEmail;

// Firm phone numbers. `tel` is the dial string (E.164), `display` is the
// reader-facing format. The office line is the AI answering number: calls to
// it are answered by the LALUM voice assistant and logged to the portal.
export const officePhone = { display: "03-3751235", tel: "+97233751235" };
export const directPhone = { display: "052-2490420", tel: "+972522490420" };
// A direct landline answered personally by the office (a human, not the AI
// assistant), alongside the AI office line and the direct mobile.
export const personalLine = { display: "03-3104959", tel: "+97233104959" };

// Business WhatsApp (international format without the plus, for wa.me links).
export const whatsappNumber = "972522490420";

// Public Telegram contact (t.me link).
export const telegramUrl = "https://t.me/Lalumbot";

// Firm accounting dashboard (Invoice4U). Surfaced only inside the admin-only
// Portal billing area, and only while payments are switched on below.
export const accountingUrl = "https://private.invoice4u.co.il/newsite/he/dashboard";

// Meeting formats offered on the Book page. Each maps to a Zoho Bookings
// service, wired in Zoho to the right conferencing (Zoom / Microsoft Teams) or
// location (phone / in-person) and synced to the firm's Outlook calendar. A
// blank `url` falls back to the base link; when both are blank, Book.tsx shows
// the manual request form instead of a broken embed.
//
// TODO: paste the real Zoho Bookings service links here once created (see
// docs/INFRASTRUCTURE.md, "Embedded scheduling"). Until then these stay blank
// on purpose, so the site never embeds a dead link.
export const bookingBaseUrl = "";
export const meetingTypes = [
  { key: "zoom", icon: "video", url: "" },
  { key: "teams", icon: "video", url: "" },
  { key: "phone", icon: "phone", url: "" },
  { key: "inperson", icon: "pin", url: "" },
] as const;
export type MeetingKey = (typeof meetingTypes)[number]["key"];

// Switch for the in-app clearing/payments feature. When true, clients can pay a
// milestone from their portal: the app hands off to the Invoice4U secure hosted
// page, which presents Google Pay, Apple Pay, Bit, and card. This never exposes
// the firm's Invoice4U account, only a single-amount checkout for that payment.
// The Meshulam clearing terminal is live and the payment function is deployed.
// A server-side safety gate in lalum-pay-create refuses to hand any client a
// sandbox checkout unless INVOICE4U_ALLOW_SANDBOX=true, so real payers only ever
// reach the production terminal (or a safe error), never a test page.
export const paymentsEnabled = true;

// Deep link into the firm's private Invoice4U dashboard (full accounting:
// up-to-date status, income, expenses, and reports). Surfaced ONLY inside the
// admin-only billing card in the Portal, so clients never see or reach it, they
// can only pay their own bills. On because the firm wants accounting at hand.
export const accountingDashboardEnabled = true;

// Direct bank transfer (Bank Leumi) as a preferred manual payment option. The
// client taps the Leumi logo, sees the firm's account details, makes the
// transfer, and confirms in the app; the confirmation lands in the admin inbox.
// This is independent of the Invoice4U clearing, so it can go live on its own.
// Fill in the account details and set `enabled` to true to show it to clients.
// Show the payment options now with a "coming soon" label, before clearing and
// the bank details are live. Set to false to hide them entirely until ready.
export const paymentsComingSoon = true;

export const bankTransfer = {
  enabled: true,
  bankName: "בנק לאומי",
  bankCode: "10",
  branch: "855",
  account: "41220/82",
  holder: "AVRAHAM AVI LALUM",
  iban: "IL600108550000004122082",
  swift: "LUMIILITXXX",
};

// Firm social profiles and the public app URL (used by the download QR).
export const socialLinks = {
  linkedin: "https://www.linkedin.com/in/dr-avraham-lalum-ab833929/",
  facebook: "https://www.facebook.com/profile.php?id=61573518832531&locale=he_IL",
  instagram: "https://www.instagram.com/",
  website: "https://www.lalum.co",
};
export const websiteDisplay = "www.lalum.co";
export const appUrl = "https://lalumapp.com";

// External pages on the firm website.
export const externalLinks = {
  qa: "https://www.lalum.co/q-a",
  articles: "https://www.lalum.co/articles",
};

// Office address (Herzliya Pituach). `full` is a single-line form for maps/travel.
export const officeAddress = {
  en: ["Herzliya Business Park, Building G", "85 Medinat HaYehudim St., 3rd Floor", "Herzliya Pituach 4676670, Israel"],
  he: ["פארק עסקים הרצליה, בניין G", "רחוב מדינת היהודים 85, קומה 3", "הרצליה פיתוח 4676670"],
  es: ["Parque Empresarial Herzliya, Edificio G", "Calle Medinat HaYehudim 85, 3.ª planta", "Herzliya Pituach 4676670, Israel"],
  fr: ["Parc d'affaires de Herzliya, Bâtiment G", "85 rue Medinat HaYehudim, 3e étage", "Herzliya Pituach 4676670, Israël"],
  ar: ["مجمع هرتسليا التجاري، مبنى G", "85 Medinat HaYehudim St.، الطابق 3", "هرتسليا بيتواح 4676670، إسرائيل"],
  full: "85 Medinat HaYehudim St, Herzliya Pituach 4676670, Israel",
};
