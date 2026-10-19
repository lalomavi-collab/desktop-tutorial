// Copy for the visitor contact form (components/LeadForm.tsx). Kept apart from the five language
// dictionaries on purpose: this is consent and privacy wording, so each language goes live only after a
// native speaker and the practice owner have read it. Hebrew and English are written; the other three fall
// back to English until they are reviewed (the same open item as the other translations).
// Bump CONSENT_VERSION here and in functions/lalum-lead-submit when the wording or the retention changes.
import type { Lang } from "./hreflang";

export const RETENTION_MONTHS = 12;

export interface LeadCopy {
  open: string; title: string; lead: string;
  name: string; phone: string; email: string; contactHint: string;
  interest: string; interests: { "real-estate": string; "ai-governance": string; other: string };
  note: string; noteHint: string;
  consentBefore: string; consentLink: string; consentAfter: string;
  submit: string; sending: string; back: string;
  thanksTitle: string; thanksBody: string;
  errConsent: string; errContact: string; errRate: string; errGeneric: string;
}

const he: LeadCopy = {
  open: "עדיין לא לקוחות? השאירו פרטים ונחזור אליכם",
  title: "השאירו פרטים ונחזור אליכם",
  lead: "מלאו את הפרטים, ונחזור אליכם בשעות העבודה.",
  name: "שם מלא", phone: "טלפון", email: "אימייל", contactHint: "נדרש טלפון או אימייל",
  interest: "תחום הפנייה",
  interests: { "real-estate": "נדל״ן והתחדשות עירונית", "ai-governance": "AI וממשל", other: "אחר" },
  note: "במה נוכל לעזור? (לא חובה)",
  noteHint: "בקצרה, ובלי פרטי התיק או שמות הצד שכנגד. את הפרטים נשמע בשיחה.",
  consentBefore: `אני מסכים/ה שהמשרד ישמור את הפרטים האלה כדי לחזור אליי, וימחק אותם בתוך ${RETENTION_MONTHS} חודשים. פירוט בנוגע לזכויותיי ב`,
  consentLink: "הודעת הפרטיות", consentAfter: ".",
  submit: "שליחה", sending: "שולח…", back: "חזרה",
  thanksTitle: "תודה, קיבלנו",
  thanksBody: "נחזור אליכם בשעות העבודה. אפשר לבקש בכל עת לעיין בפרטים או למחוק אותם, בפנייה אלינו.",
  errConsent: "כדי לשלוח יש לאשר את שמירת הפרטים.",
  errContact: "יש להזין שם, וגם טלפון או אימייל תקינים.",
  errRate: "נשלחו כמה פניות בזמן קצר. נסו שוב מאוחר יותר.",
  errGeneric: "משהו השתבש. נסו שוב עוד רגע.",
};

const en: LeadCopy = {
  open: "Not a client yet? Leave your details and we will get back to you",
  title: "Leave your details and we will get back to you",
  lead: "Fill in your details and we will reply during business hours.",
  name: "Full name", phone: "Phone", email: "Email", contactHint: "A phone number or an email is required",
  interest: "Area",
  interests: { "real-estate": "Real estate and urban renewal", "ai-governance": "AI and governance", other: "Other" },
  note: "How can we help? (optional)",
  noteHint: "Briefly, and without case details or the other party's names. We will hear the details on a call.",
  consentBefore: `I agree that the firm keeps these details to get back to me and deletes them within ${RETENTION_MONTHS} months. More about my rights in the `,
  consentLink: "privacy notice", consentAfter: ".",
  submit: "Send", sending: "Sending…", back: "Back",
  thanksTitle: "Thank you, we have it",
  thanksBody: "We will reply during business hours. You can ask at any time to see your details or to have them deleted, by contacting us.",
  errConsent: "To send, please confirm that we may keep your details.",
  errContact: "Please enter a name and a valid phone number or email.",
  errRate: "Several requests were sent in a short time. Please try again later.",
  errGeneric: "Something went wrong. Please try again in a moment.",
};

export function leadCopy(lang: Lang): LeadCopy {
  return lang === "he" ? he : en;
}
