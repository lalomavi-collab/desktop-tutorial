// SYNTHETIC demo data for the partner, matter and portal previews. Every name, amount and date here is invented.
// Dates are relative to "today" so aging and the forecast stay meaningful on any day. Nothing in this file touches the database.
// The invoice and payment rows use the real ledger types, so replacing this file with the ledger query changes no component.
import type { FinCustomer, FinDocument, FinPayment } from "./finance.ts";
import { addDays, iso } from "./crm.ts";
import type { Obligation, TimeEntry, TrustEntry } from "./crm.ts";

export const DEMO_NOTE = "נתוני הדגמה בדויים. החיבור לנתוני Invoice4U האמיתיים נעשה במקור הנתונים בלבד, בלי שינוי ברכיבים.";

const ago = (t: Date, n: number) => iso(addDays(t, -n));

export interface DemoMatter { id: string; number: string; title: string; client: string; court: string; bench: string; stage: string; stageIndex: number; attorney: string }
export interface Party { id: string; role: "CLIENT" | "OPPOSING" | "OPPOSING_COUNSEL" | "JUDGE" | "EXPERT" | "WITNESS"; name: string; phone?: string; email?: string }
export interface Milestone { id: string; title: string; on: string; kind: "HEARING" | "FILING" | "INTERNAL"; clientVisible: boolean }
export interface StagedDoc { id: string; name: string; uploadedOn: string; status: "PENDING_REVIEW" | "APPROVED" | "REVISION"; note?: string; category?: string }
export interface Message { id: string; from: "CLIENT" | "TEAM"; at: string; text: string; internal: boolean }
export interface Activity { id: string; at: string; kind: "MESSAGE" | "UPLOAD"; text: string; matterId: string }

export const STAGES = ["קליטה", "כתבי טענות", "גילוי מסמכים", "הוכחות", "סיכומים", "פסק דין"];

export function buildDemo(today: Date) {
  const customers: FinCustomer[] = [
    { id: "c1", name: "לקוח לדוגמה א", tax_id: null, email: null, phone: null, address: null, city: null, notes: null, archived: false, i4u_customer_id: null },
    { id: "c2", name: "לקוח לדוגמה ב", tax_id: null, email: null, phone: null, address: null, city: null, notes: null, archived: false, i4u_customer_id: null },
    { id: "c3", name: "לקוח לדוגמה ג", tax_id: null, email: null, phone: null, address: null, city: null, notes: null, archived: false, i4u_customer_id: null },
  ];
  const inv = (id: string, cust: string, total: number, issuedAgo: number, dueAgo: number | null, n: number): FinDocument => ({
    id, customer_id: cust, doc_type: "INVOICE", status: "ISSUED", subject: "שכר טרחה", tax_included: false, vat_rate: 18, lines: [],
    subtotal: Math.round((total / 1.18) * 100) / 100, vat_amount: Math.round((total - total / 1.18) * 100) / 100, total,
    issue_date: ago(today, issuedAgo), due_date: dueAgo == null ? null : ago(today, dueAgo), payment_method: null, payment_ref: null,
    related_doc_id: null, send_email: false, doc_number: n, i4u_doc_id: null, allocation_number: null, pdf_url: null, is_test: false, last_error: null, issued_at: null,
  });
  const docs: FinDocument[] = [
    inv("i1", "c1", 23600, 130, 100, 1001), inv("i2", "c2", 11800, 95, 65, 1002), inv("i3", "c3", 17700, 58, 28, 1003),
    inv("i4", "c1", 8850, 20, -10, 1004), inv("i5", "c2", 35400, 12, -18, 1005), inv("i6", "c3", 5900, 150, 120, 1006),
    inv("i7", "c1", 14160, 40, null, 1007),
  ];
  const pay = (id: string, doc: string, cust: string, amount: number, paidAgo: number): FinPayment => ({ id, customer_id: cust, document_id: doc, paid_on: ago(today, paidAgo), amount, method: "TRANSFER", reference: null, notes: null });
  const payments: FinPayment[] = [
    pay("p1", "i6", "c3", 5900, 90), pay("p2", "i1", "c1", 5000, 60), pay("p3", "i3", "c3", 4000, 9), pay("p4", "i5", "c2", 10000, 4),
  ];
  const obligations: Obligation[] = [
    { id: "o1", label: "שכר עובדים", kind: "PAYROLL", amount: 38000, every: "MONTH", day: 9 },
    { id: "o2", label: "שכירות משרד", kind: "RENT", amount: 12500, every: "MONTH", day: 1 },
    { id: "o3", label: "ספקים ותוכנה", kind: "SUPPLIER", amount: 2400, every: "WEEK" },
    { id: "o4", label: "מקדמות מס", kind: "TAX", amount: 9000, every: "MONTH", day: 15 },
  ];
  const matters: DemoMatter[] = [
    { id: "m1", number: "ת״א 00000-01-26", title: "תביעה כספית לדוגמה", client: customers[0].name, court: "בית משפט השלום, מחוז מרכז", bench: "כב׳ השופט לדוגמה", stage: STAGES[2], stageIndex: 2, attorney: "עו״ד לדוגמה" },
    { id: "m2", number: "ה״פ 00000-02-26", title: "המרצת פתיחה לדוגמה", client: customers[1].name, court: "בית המשפט המחוזי", bench: "כב׳ השופטת לדוגמה", stage: STAGES[1], stageIndex: 1, attorney: "עו״ד לדוגמה" },
  ];
  const parties: Party[] = [
    { id: "pa1", role: "CLIENT", name: customers[0].name, phone: "050-0000001", email: "client@example.test" },
    { id: "pa2", role: "OPPOSING", name: "צד שכנגד לדוגמה בע״מ" },
    { id: "pa3", role: "OPPOSING_COUNSEL", name: "עו״ד נגדי לדוגמה", phone: "03-0000000", email: "counsel@example.test" },
    { id: "pa4", role: "JUDGE", name: "כב׳ השופט לדוגמה" },
    { id: "pa5", role: "EXPERT", name: "מומחה לדוגמה", email: "expert@example.test" },
    { id: "pa6", role: "WITNESS", name: "עד לדוגמה" },
  ];
  const d = (n: number) => iso(addDays(today, n));
  const milestones: Milestone[] = [
    { id: "ms1", title: "דיון קדם משפט", on: d(21), kind: "HEARING", clientVisible: true },
    { id: "ms2", title: "מועד הגשת תצהירי עדות ראשית", on: d(35), kind: "FILING", clientVisible: true },
    { id: "ms3", title: "הכנת טיוטת סיכומים (פנימי)", on: d(14), kind: "INTERNAL", clientVisible: false },
  ];
  const staged: StagedDoc[] = [
    { id: "sd1", name: "חוזה חתום.pdf", uploadedOn: d(-1), status: "PENDING_REVIEW" },
    { id: "sd2", name: "תכתובת מייל.pdf", uploadedOn: d(-3), status: "PENDING_REVIEW" },
    { id: "sd3", name: "קבלות.pdf", uploadedOn: d(-9), status: "APPROVED", category: "ראיות" },
    { id: "sd4", name: "תצלום מסך.png", uploadedOn: d(-6), status: "REVISION", note: "הקובץ חתוך. נא להעלות את המסמך המלא." },
  ];
  const messages: Message[] = [
    { id: "ms-a", from: "CLIENT", at: new Date(today.getTime() - 5 * 3600000).toISOString(), text: "העליתי את החוזה, אשמח לאישור קבלה.", internal: false },
    { id: "ms-b", from: "TEAM", at: new Date(today.getTime() - 3 * 3600000).toISOString(), text: "התקבל, אנחנו בודקים ונחזור אליך.", internal: false },
    { id: "ms-c", from: "TEAM", at: new Date(today.getTime() - 2 * 3600000).toISOString(), text: "הערה פנימית: לבדוק התיישנות לפני שליחת מכתב התראה.", internal: true },
  ];
  const activity: Activity[] = [
    { id: "a1", at: messages[0].at, kind: "MESSAGE", text: "הודעה חדשה מהלקוח בתיק תביעה כספית לדוגמה", matterId: "m1" },
    { id: "a2", at: new Date(today.getTime() - 26 * 3600000).toISOString(), kind: "UPLOAD", text: "הועלה מסמך: חוזה חתום.pdf", matterId: "m1" },
    { id: "a3", at: new Date(today.getTime() - 50 * 3600000).toISOString(), kind: "UPLOAD", text: "הועלה מסמך: תכתובת מייל.pdf", matterId: "m1" },
  ];
  const time: TimeEntry[] = [
    { id: "t1", matterId: "m1", on: d(-4), hours: 3.5, rate: 900, action: "ניסוח כתב טענות", billed: false },
    { id: "t2", matterId: "m1", on: d(-2), hours: 1.25, rate: 900, action: "שיחה עם לקוח", billed: false },
    { id: "t3", matterId: "m2", on: d(-6), hours: 6, rate: 900, action: "מחקר משפטי", billed: false },
    { id: "t4", matterId: "m1", on: d(-30), hours: 4, rate: 900, action: "ישיבה", billed: true },
  ];
  const trust: TrustEntry[] = [
    { id: "tr1", matterId: "m1", on: d(-50), kind: "DEPOSIT", amount: 20000, note: "פיקדון ראשוני" },
    { id: "tr2", matterId: "m1", on: d(-25), kind: "APPLY", amount: 8000, note: "קיזוז מול חשבונית" },
    { id: "tr3", matterId: "m2", on: d(-12), kind: "DEPOSIT", amount: 5000, note: "פיקדון ראשוני" },
  ];
  return {
    customers, docs, payments, obligations, matters, parties, milestones, staged, messages, activity, time, trust,
    // Not available from Invoice4U: entered by the partner (or a bank feed later).
    bankBalance: 64000, minThreshold: 25000, retainerFloor: 4000,
  };
}
export type Demo = ReturnType<typeof buildDemo>;
