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

// Firm accounting dashboard (Invoice4U). Admin-only quick link in the header.
export const accountingUrl = "https://private.invoice4u.co.il/newsite/he/dashboard";

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
