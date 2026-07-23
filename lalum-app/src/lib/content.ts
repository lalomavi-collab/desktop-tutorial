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
  | "check";

export type Row = { icon: IconName; title: string; sub: string; tag: string };
export type Pillar = { icon: IconName; tag: string; title: string; body: string };
export type Framework = { code: string; title: string; icon: IconName; body: string };
export type Why = { icon: IconName; title: string; body: string };
export type Faq = { q: string; a: string };
export type Service = { icon: IconName; title: string; body: string };
export type Module = { icon: IconName; title: string; body: string };
export type Testimonial = { quote: string; attr: string };
export type Plan = {
  name: string;
  tagline: string;
  best: string;
  popular: boolean;
  features: string[];
  cta: string;
};
export type Audience = { icon: IconName; title: string; body: string; points: string[] };
export type Format = { meta: string; title: string; body: string };

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] };

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

// Business WhatsApp (international format without the plus, for wa.me links).
export const whatsappNumber = "972522490420";

// Public Telegram contact (t.me link).
export const telegramUrl = "https://t.me/Lalumbot";

// Firm accounting dashboard (Invoice4U). Surfaced only inside the admin-only
// Portal billing area, and only while payments are switched on below.
export const accountingUrl = "https://private.invoice4u.co.il/newsite/he/dashboard";

// Meeting formats offered on the Book page. Each maps to a Calendly event type
// wired in Calendly to the right conferencing (Zoom / Microsoft Teams) or
// location (phone / in-person) and to the firm's Outlook calendar. Teams is the
// second video option (it works with Outlook, unlike Google Meet). A blank
// `url` falls back to the base link.
export const bookingBaseUrl = "https://calendly.com/lalomavi/30min";
export const meetingTypes = [
  { key: "zoom", icon: "video", url: "https://calendly.com/lalomavi/zoom" },
  { key: "teams", icon: "video", url: "https://calendly.com/lalomavi/teams" },
  { key: "phone", icon: "phone", url: "https://calendly.com/lalomavi/phone" },
  { key: "inperson", icon: "pin", url: "https://calendly.com/lalomavi/in-person" },
] as const;
export type MeetingKey = (typeof meetingTypes)[number]["key"];

// Switch for the in-app clearing/payments feature. When true, clients can pay a
// milestone from their portal: the app hands off to the Invoice4U secure hosted
// page, which presents Google Pay, Apple Pay, Bit, and card. This never exposes
// the firm's Invoice4U account, only a single-amount checkout for that payment.
// Kept off until the Invoice4U clearing terminal is live, so no Pay buttons show
// on the site while a charge would fail. Flip to true once clearing is verified.
export const paymentsEnabled = false;

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
export const bankTransfer = {
  enabled: false,
  bankName: "בנק לאומי",
  bankCode: "10",
  branch: "", // מספר סניף
  account: "", // מספר חשבון
  holder: "", // שם בעל החשבון
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
  full: "85 Medinat HaYehudim St, Herzliya Pituach 4676670, Israel",
};
