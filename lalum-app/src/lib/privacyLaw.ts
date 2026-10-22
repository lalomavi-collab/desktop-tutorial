// The Privacy Protection Law and Amendment 13, explained from the consolidated text.
//
// The page, the printed booklet and the video all read src/data/privacyLaw.json, so
// a claim about the law has one home. Every item carries the section it rests on.
// Israeli law only.
import data from "../data/privacyLaw.json";

export type LawItem = { section: string; title: string; text: string; practical?: string };
export type LawGroup = { id: string; title: string; items: LawItem[] };
export type Regulation = { name: string; short: string; duties: string[] };

export const privacyLaw = data as {
  title: string; description: string; lead: string; published: string;
  basics: LawItem[]; groups: LawGroup[];
  ai: { intro: string; items: LawItem[] };
  regulations: Regulation[]; checklist: string[]; limits: string[]; disclaimer: string;
};

export const PRIVACY_TITLE = "הגנת הפרטיות ותיקון 13: מדריך, חוברת וסרטון | LALUM";
export const PRIVACY_DESC = "מה קובע חוק הגנת הפרטיות אחרי תיקון 13, מה זה אומר על עבודה עם בינה מלאכותית, וחוברת הסבר וסרטון, מנוסח החוק הישראלי.";
export const PRIVACY_BOOKLET = "/downloads/lalum-hagnat-hapratiyut-tikun-13.pdf";
export const PRIVACY_VIDEO = "/media/lalum-privacy-law.mp4";
export const PRIVACY_POSTER = "/media/lalum-privacy-law.jpg";
