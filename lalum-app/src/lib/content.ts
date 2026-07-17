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
// reader-facing format.
export const officePhone = { display: "03-3104959", tel: "+97233104959" };
export const directPhone = { display: "052-2490420", tel: "+972522490420" };

// Firm social profiles and the public app URL (used by the download QR).
export const socialLinks = {
  linkedin: "https://www.linkedin.com/in/dr-avraham-lalum-ab833929/",
  facebook: "https://www.facebook.com/profile.php?id=61573518832531&locale=he_IL",
};
export const appUrl = "https://lalumapp.com";
