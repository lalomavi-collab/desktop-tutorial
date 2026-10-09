// KYC control record. The server keeps only enumerations, yes/no answers and a date: never a name,
// an identifier or free text (see migration 0009). The identifying details themselves stay in the
// firm's own file. The checklist is the firm's internal procedure; which duties apply to a given
// matter is for the responsible attorney to decide.

export interface KycRecord {
  id?: string;
  party_no: number;
  party_role: string;
  subject_kind: string;
  service_track: string;
  id_verified: boolean | null;
  id_method: string | null;
  registry_checked: boolean | null;
  signatory_verified: boolean | null;
  beneficial_owner_identified: boolean | null;
  source_of_funds: string | null;
  source_documented: boolean | null;
  pep: string | null;
  sanctions_screened: boolean | null;
  risk: string | null;
  status: string;
  completed_at: string | null;
  next_review_on: string | null;
}

export const blankKyc = (party_no: number): KycRecord => ({
  party_no, party_role: "CLIENT", subject_kind: "INDIVIDUAL", service_track: "REGULAR",
  id_verified: null, id_method: null, registry_checked: null, signatory_verified: null, beneficial_owner_identified: null,
  source_of_funds: null, source_documented: null, pep: null, sanctions_screened: null, risk: null,
  status: "DRAFT", completed_at: null, next_review_on: null,
});

export const KYC_LABEL = {
  party_role: { CLIENT: "לקוח", REPRESENTATIVE: "מיופה כוח או מורשה", BENEFICIAL_OWNER: "בעל שליטה" },
  subject_kind: { INDIVIDUAL: "אדם פרטי", COMPANY: "תאגיד" },
  service_track: { REGULAR: "שירות משפטי רגיל", BUSINESS_SERVICE: "שירות עסקי" },
  id_method: { IN_PERSON: "פגישה פיזית מול מסמך מקורי", REMOTE: "זיהוי מרחוק", THIRD_PARTY: "אימות באמצעות גורם שלישי" },
  source_of_funds: {
    SALARY: "שכר", BUSINESS_INCOME: "הכנסה עסקית", PROPERTY_SALE: "מכירת נכס", SAVINGS: "חסכונות", INHERITANCE_GIFT: "ירושה או מתנה",
    LOAN: "הלוואה", OTHER: "אחר", NOT_APPLICABLE: "לא רלוונטי",
  },
  pep: { NO: "לא", YES: "כן", REVIEW: "דורש בירור" },
  risk: { LOW: "נמוכה", MEDIUM: "בינונית", HIGH: "גבוהה" },
} as const;

export const KYC_FIELD_LABEL: Record<string, string> = {
  id_verified: "הזיהוי אומת מול מסמך",
  id_method: "אופן הזיהוי",
  registry_checked: "נבדק נסח רישום התאגיד",
  signatory_verified: "אומתה זכות החתימה",
  beneficial_owner_identified: "זוהה בעל השליטה",
  source_of_funds: "מקור הכספים",
  source_documented: "מקור הכספים נתמך במסמכים",
  pep: "נושא משרה ציבורית בכירה",
  sanctions_screened: "בוצעה בדיקת סנקציות",
  risk: "רמת סיכון",
};

/** Mirrors lalum_kyc_missing in the database, for instant feedback. The server is authoritative. */
export function kycMissing(r: KycRecord): string[] {
  const m: string[] = [];
  if (r.id_verified !== true) m.push("id_verified");
  if (!r.id_method) m.push("id_method");
  if (r.subject_kind === "COMPANY") {
    if (r.registry_checked !== true) m.push("registry_checked");
    if (r.signatory_verified !== true) m.push("signatory_verified");
    if (r.beneficial_owner_identified !== true) m.push("beneficial_owner_identified");
  }
  if (!r.source_of_funds) m.push("source_of_funds");
  else if (r.source_of_funds !== "NOT_APPLICABLE" && r.source_documented === null) m.push("source_documented");
  if (!r.pep) m.push("pep");
  if (r.sanctions_screened !== true) m.push("sanctions_screened");
  if (!r.risk) m.push("risk");
  return m;
}

export const needsPartner = (r: KycRecord): boolean => r.risk === "HIGH" || r.pep === "YES";

/** Business service records that are not complete: the export gate shows a warning for them. */
export const pendingBusiness = (rs: KycRecord[]): number => rs.filter((r) => r.service_track === "BUSINESS_SERVICE" && r.status !== "COMPLETE").length;
