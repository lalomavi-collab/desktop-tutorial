import { useMemo, useState } from 'react';
import { Building2, Upload, AlertTriangle, CheckCircle2, XCircle, FileText, Calculator } from 'lucide-react';

interface DealParams {
  price: number;
  expectedValue: number;
  renovationCost: number;
  otherCosts: number;
  equity: number;
  loanRate: number;
  loanYears: number;
  isSingleHome: boolean;
}

interface UploadedDoc {
  name: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  registry: 'נסח טאבו / רישום',
  planning: 'תכנוני',
  appraisal: 'שמאות',
  contract: 'הסכם',
  financing: 'מימון',
  tax: 'מיסוי',
  cashflow: 'תזרים',
  costs: 'עלויות',
  other: 'אחר',
};

const DOC_KEYWORDS: [string, string][] = [
  ['טאבו', 'registry'],
  ['נסח', 'registry'],
  ['תבע', 'planning'],
  ['תכנונ', 'planning'],
  ['היתר', 'planning'],
  ['שמא', 'appraisal'],
  ['שווי', 'appraisal'],
  ['הסכם', 'contract'],
  ['חוזה', 'contract'],
  ['משכנתא', 'financing'],
  ['מימון', 'financing'],
  ['מס', 'tax'],
  ['תזרים', 'cashflow'],
  ['עלויות', 'costs'],
];

function classify(filename: string): string {
  for (const [kw, cat] of DOC_KEYWORDS) {
    if (filename.includes(kw)) return cat;
  }
  return 'other';
}

const CHECKLIST_ITEMS: [string, string][] = [
  ['נסח טאבו עדכני', 'registry'],
  ['תב"ע וזכויות בנייה', 'planning'],
  ['חוות דעת שמאי', 'appraisal'],
  ['הסכם / טיוטה', 'contract'],
  ['אישור מימון', 'financing'],
  ['אומדן מיסוי', 'tax'],
];

function purchaseTax(price: number, isSingleHome: boolean): number {
  if (isSingleHome) return Math.max(0, price - 2_000_000) * 0.035;
  const threshold = 6_055_070;
  if (price > threshold) return threshold * 0.08 + (price - threshold) * 0.1;
  return price * 0.08;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('he-IL');
}

export function DealAnalysisView() {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [params, setParams] = useState<DealParams>({
    price: 2_800_000,
    expectedValue: 4_100_000,
    renovationCost: 450_000,
    otherCosts: 85_000,
    equity: 1_200_000,
    loanRate: 5.5,
    loanYears: 2.5,
    isSingleHome: false,
  });

  const analysis = useMemo(() => {
    const tax = purchaseTax(params.price, params.isSingleHome);
    const costBeforeFinance = params.price + tax + params.renovationCost + params.otherCosts;
    const loan = Math.max(0, costBeforeFinance - params.equity);
    const financeCost = loan * (params.loanRate / 100) * params.loanYears;
    const totalInvestment = costBeforeFinance + financeCost;
    const grossProfit = params.expectedValue - totalInvestment;
    const capGainsTax = Math.max(0, grossProfit) * 0.25;
    const netProfit = grossProfit - capGainsTax;
    const equityBase = params.equity > 0 ? params.equity : totalInvestment;
    const roi = (netProfit / equityBase) * 100;
    const annualRoi = params.loanYears ? roi / params.loanYears : roi;
    const verdict = annualRoi >= 12 ? 'כדאית' : annualRoi >= 6 ? 'גבולית' : 'לא כדאית';
    const sensitivity = [-10, -5, 0, 5, 10].map((d) => {
      const v = params.expectedValue * (1 + d / 100);
      const gp = v - totalInvestment;
      const np = gp - Math.max(0, gp) * 0.25;
      return { delta: d, value: v, netProfit: np, roi: (np / equityBase) * 100 };
    });
    return { tax, totalInvestment, financeCost, grossProfit, capGainsTax, netProfit, roi, annualRoi, verdict, sensitivity, loan };
  }, [params]);

  const foundCategories = new Set(docs.map((d) => d.category));

  const onUpload = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).map((f) => ({ name: f.name, category: classify(f.name) }));
    setDocs((prev) => [...prev, ...added]);
  };

  const setNum = (key: keyof DealParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }));

  const verdictColor =
    analysis.verdict === 'כדאית' ? 'text-green-400 border-green-500/40 bg-green-500/10'
    : analysis.verdict === 'גבולית' ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
    : 'text-red-400 border-red-500/40 bg-red-500/10';

  return (
    <div className="text-right" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-2xl">ניתוח עסקאות נדל"ן</h1>
          <p className="text-gray-500 text-sm mt-0.5">משפט, קניין, שמאות ומימון במסך אחד</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* העלאת מסמכים */}
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Upload size={16} className="text-amber-400" /> מסמכי העסקה
          </h2>
          <label className="block border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-amber-500/50 transition-colors">
            <input type="file" multiple className="hidden" accept=".pdf,.xls,.xlsx,.csv,.txt,.json"
              onChange={(e) => onUpload(e.target.files)} />
            <FileText size={22} className="mx-auto text-gray-500 mb-2" />
            <p className="text-gray-400 text-sm">גרור לכאן קבצים או לחץ לבחירה (PDF / XLS / CSV)</p>
            <p className="text-gray-600 text-xs mt-1">נסח טאבו, תב"ע, שמאות, הסכם, מימון</p>
          </label>
          {docs.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-300 truncate">{d.name}</span>
                  <span className="text-amber-400 text-xs shrink-0 mr-2">{CATEGORY_LABELS[d.category]}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-white font-medium mt-5 mb-2 text-sm">צ'ק-ליסט שלמות תיק</h3>
          <ul className="space-y-1.5">
            {CHECKLIST_ITEMS.map(([label, cat]) => {
              const ok = foundCategories.has(cat);
              return (
                <li key={cat} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 size={15} className="text-green-400" /> : <XCircle size={15} className="text-gray-600" />}
                  <span className={ok ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
                </li>
              );
            })}
          </ul>
          {docs.length > 0 && !foundCategories.has('appraisal') && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> חסרה חוות דעת שמאי, מומלץ להשלים לפני החלטה
            </div>
          )}
        </div>

        {/* מחשבון כדאיות */}
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Calculator size={16} className="text-amber-400" /> מחשבון כדאיות
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['מחיר רכישה', 'price'],
              ['שווי צפוי', 'expectedValue'],
              ['השבחה / שיפוץ', 'renovationCost'],
              ['עלויות נלוות', 'otherCosts'],
              ['הון עצמי', 'equity'],
            ] as [string, keyof DealParams][]).map(([label, key]) => (
              <label key={key} className="text-xs text-gray-400">
                {label}
                <input type="number" value={params[key] as number} onChange={setNum(key)}
                  className="mt-1 w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none" />
              </label>
            ))}
            <label className="text-xs text-gray-400">
              ריבית שנתית (%)
              <input type="number" step="0.1" value={params.loanRate} onChange={setNum('loanRate')}
                className="mt-1 w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none" />
            </label>
            <label className="text-xs text-gray-400">
              משך (שנים)
              <input type="number" step="0.5" value={params.loanYears} onChange={setNum('loanYears')}
                className="mt-1 w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none" />
            </label>
            <label className="text-xs text-gray-400 flex items-end gap-2 pb-2">
              <input type="checkbox" checked={params.isSingleHome}
                onChange={(e) => setParams((p) => ({ ...p, isSingleHome: e.target.checked }))}
                className="accent-amber-500" />
              דירה יחידה
            </label>
          </div>

          <div className={`mt-4 border rounded-xl px-4 py-3 font-semibold ${verdictColor}`}>
            העסקה {analysis.verdict} · תשואה שנתית {analysis.annualRoi.toFixed(1)}%
          </div>

          <table className="w-full mt-4 text-sm">
            <tbody>
              {([
                ['מס רכישה (אומדן)', analysis.tax],
                ['סכום הלוואה', analysis.loan],
                ['עלות מימון', analysis.financeCost],
                ['סך השקעה', analysis.totalInvestment],
                ['מס שבח (אומדן)', analysis.capGainsTax],
                ['רווח נקי צפוי', analysis.netProfit],
              ] as [string, number][]).map(([label, val]) => (
                <tr key={label} className="border-b border-gray-800">
                  <td className="py-2 text-gray-400">{label}</td>
                  <td className={`py-2 font-medium ${label === 'רווח נקי צפוי' ? (val >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-200'}`}>
                    {fmt(val)} ₪
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ניתוח רגישות */}
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5 lg:col-span-2">
          <h2 className="text-white font-semibold mb-3">ניתוח רגישות לשווי המכירה</h2>
          <div className="grid grid-cols-5 gap-3">
            {analysis.sensitivity.map((s) => (
              <div key={s.delta}
                className={`rounded-xl border p-3 text-center ${s.delta === 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-800 bg-[#0f1117]'}`}>
                <div className="text-gray-500 text-xs">{s.delta > 0 ? `+${s.delta}` : s.delta}% בשווי</div>
                <div className={`font-bold mt-1 ${s.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(s.netProfit)} ₪</div>
                <div className="text-gray-400 text-xs mt-0.5">תשואה {s.roi.toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-4">
            כלי עזר לניתוח ראשוני בלבד. אינו מהווה ייעוץ משפטי, שמאי, מיסויי או מימוני.
          </p>
        </div>
      </div>
    </div>
  );
}
