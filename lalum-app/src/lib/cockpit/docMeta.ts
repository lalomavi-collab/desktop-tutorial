// Closed lists for classifying a document when it enters a matter. No free text on purpose: a free-text label would sit
// outside the PII shield, so every answer is a choice from these lists (mirrored by check constraints in migration 0009).
export const DOC_TYPE: Record<string, string> = {
  CONTRACT: "חוזה או הסכם",
  CORRESPONDENCE: "התכתבות או הודעה",
  COURT_FILING: "כתב בית דין או החלטה",
  AUTHORITY: "מסמך מרשות או גוף ציבורי",
  OPINION: "חוות דעת",
  EVIDENCE: "ראיה או נספח",
  OTHER: "אחר",
};
export const DOC_ORIGIN: Record<string, string> = {
  CLIENT: "הלקוח",
  ADVERSE: "הצד שכנגד",
  COURT: "בית משפט או בורר",
  AUTHORITY: "רשות או גוף ציבורי",
  INTERNAL: "המשרד",
  THIRD_PARTY: "צד שלישי",
};
