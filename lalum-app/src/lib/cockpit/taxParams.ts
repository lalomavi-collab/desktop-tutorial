// Statutory parameters of the Israeli tax year, kept as data and never inside the engine's formulas.
// A change of law or an annual indexation is a new row here (or in `lalum_tax_params`, which overrides this file),
// not an edit to taxEngine.ts. Every year carries its status: only VERIFIED parameters produce a final figure.
// The sources rule of this repository applies: a figure counts as VERIFIED only after it was read from the
// instrument itself (Tax Authority, National Insurance Institute) and agreed by a second independent source.

export interface Bracket { /** Upper bound of the bracket in shekels per year; null means no upper bound. */ upTo: number | null; rate: number }

export interface TaxParams {
  year: number;
  /** DRAFT is never shown as final. VERIFIED needs `verifiedAt` and at least two `sources`. */
  status: "VERIFIED" | "DRAFT";
  verifiedAt: string | null;
  sources: string[];
  notes: string;
  brackets: Bracket[];
  /** Value of one credit point per year. */
  creditPointAnnual: number;
  surtax: { threshold: number; rate: number };
  /** Monthly figures of the self-employed National Insurance and health tax. */
  bl: {
    reducedCeiling: number; reducedNi: number; reducedHealth: number;
    fullNi: number; fullHealth: number; maxMonthly: number; minMonthly: number;
  };
  /** Share of the pure National Insurance component (health tax excluded) deductible from income. */
  niDeductionRate: number;
  /** null means the ceiling is not set for this year: the deduction is then not applied and a warning is raised. */
  hishtalmut: { rate: number; incomeCeiling: number | null };
  pension: { deductionRate: number; creditRate: number; creditBaseRate: number; incomeCeiling: number | null };
  corporateRate: number;
  dividendRate: { regular: number; substantial: number };
  vatRate: number;
}

export const TAX_PARAMS: Record<number, TaxParams> = {
  2026: {
    year: 2026,
    status: "DRAFT",
    verifiedAt: null,
    sources: [],
    notes: "טיוטה. הסכומים הוזנו מידע כללי ומאתר מסחרי אחד, ולא נקראו מהמקור הרשמי. אין להציג תוצאה כסופית עד לאימות מול רשות המסים והביטוח הלאומי.",
    brackets: [
      { upTo: 84120, rate: 0.10 }, { upTo: 120720, rate: 0.14 }, { upTo: 193800, rate: 0.20 },
      { upTo: 269280, rate: 0.31 }, { upTo: 560280, rate: 0.35 }, { upTo: null, rate: 0.47 },
    ],
    creditPointAnnual: 2904,
    surtax: { threshold: 721560, rate: 0.03 },
    bl: { reducedCeiling: 7703, reducedNi: 0.0447, reducedHealth: 0.0323, fullNi: 0.1283, fullHealth: 0.0517, maxMonthly: 51910, minMonthly: 3442 },
    niDeductionRate: 0.52,
    hishtalmut: { rate: 0.045, incomeCeiling: null },
    pension: { deductionRate: 0.11, creditRate: 0.35, creditBaseRate: 0.05, incomeCeiling: null },
    corporateRate: 0.23,
    dividendRate: { regular: 0.25, substantial: 0.30 },
    vatRate: 0.18,
  },
};

/** Problems that stop a figure from being presented as final. Empty means the year can be trusted. */
export function paramsProblems(p: TaxParams | undefined, year: number): string[] {
  if (!p) return [`אין פרמטרי מס לשנת ${year}`];
  const out: string[] = [];
  if (p.status !== "VERIFIED") out.push(`פרמטרי המס של ${year} הם טיוטה ולא אומתו`);
  else {
    if (!p.verifiedAt) out.push("חסר תאריך אימות");
    if (new Set(p.sources).size < 2) out.push("נדרשים שני מקורות בלתי תלויים");
  }
  if (p.hishtalmut.incomeCeiling == null) out.push("תקרת הכנסה לקרן השתלמות לא הוגדרה, הניכוי לא מחושב");
  if (p.pension.incomeCeiling == null) out.push("תקרת הכנסה לפנסיה לא הוגדרה, הניכוי והזיכוי לא מחושבים");
  return out;
}

/** Parameters for a tax year. A row from the database (already validated by its own table) replaces the file's. */
export function paramsFor(year: number, fromDb: TaxParams[] = []): TaxParams | undefined {
  return fromDb.find((p) => p.year === year) ?? TAX_PARAMS[year];
}

/**
 * Staleness alarm, run by `npm run tax-check` and the weekly workflow. `today` is an ISO date.
 * From 1 November the next year's parameters must already exist, because indexation lands on 1 January.
 */
export function paramsStaleness(today: string, all: Record<number, TaxParams> = TAX_PARAMS): string[] {
  const y = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const out: string[] = [];
  const cur = all[y];
  if (!cur) out.push(`אין פרמטרים לשנה הנוכחית ${y}`);
  else if (cur.status !== "VERIFIED") out.push(`פרמטרי ${y} עדיין טיוטה`);
  if (month >= 11 && !all[y + 1]) out.push(`אין עדיין פרמטרים ל-${y + 1}, העדכון בינואר`);
  return out;
}
