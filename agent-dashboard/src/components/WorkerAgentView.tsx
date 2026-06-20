import { useState } from 'react';
import {
  Briefcase, Search, Brain, MousePointerClick, CheckCircle2,
  XCircle, Clock, FileText, User, MapPin, DollarSign,
  AlertCircle, Loader2, Camera, ScrollText, ChevronRight,
  Shield, ExternalLink, Tag, Building2, Send, SkipForward,
  Sparkles, BarChart3, CalendarClock, Zap, AlertTriangle,
  GraduationCap, BookOpen, Edit3, Upload,
} from 'lucide-react';
import { initialJobQueue } from '../data/mockData';
import type { JobCandidate, JobDecision } from '../types';

interface WorkerAgentViewProps {
  onBreadcrumbCeo?: () => void;
}

// ─── Profile data ──────────────────────────────────────────────────────────

type FieldStatus = 'filled' | 'missing' | 'partial';

interface ProfileField {
  key: string;
  label: string;
  value: string;
  status: FieldStatus;
  required: boolean;
  hint?: string;
}

const profileSections: { title: string; icon: typeof User; fields: ProfileField[] }[] = [
  {
    title: 'פרטים אישיים',
    icon: User,
    fields: [
      { key: 'full_name', label: 'שם מלא', value: 'Dr. Avraham (Avi) Lalum', status: 'filled', required: true },
      { key: 'email', label: 'אימייל', value: 'avraham@lalum.co', status: 'filled', required: true },
      { key: 'phone', label: 'טלפון', value: '+972-52-249-0420', status: 'filled', required: true },
      { key: 'location', label: 'מיקום', value: 'ישראל (אזור תל אביב)', status: 'filled', required: true },
      { key: 'linkedin', label: 'LinkedIn URL', value: 'linkedin.com/in/avraham-lalum', status: 'partial', required: true, hint: 'וודא שה-URL המדויק מעודכן' },
      { key: 'website', label: 'אתר אישי', value: 'www.lalum.co', status: 'filled', required: false },
      { key: 'orcid', label: 'ORCID', value: '0000-0001-6094-5303', status: 'filled', required: false },
    ],
  },
  {
    title: 'השכלה אקדמית',
    icon: GraduationCap,
    fields: [
      { key: 'phd_institution', label: 'מוסד הדוקטורט', value: 'University of Córdoba, Spain (2022–2026)', status: 'filled', required: true },
      { key: 'phd_field', label: 'תחום הדוקטורט', value: 'Law & Economics', status: 'filled', required: true },
      { key: 'phd_thesis', label: 'נושא הדיסרטציה', value: 'AI-based risk modeling and property-rights theory at the intersection of AI, law and economics', status: 'filled', required: true },
      { key: 'phd_year', label: 'שנת סיום משוערת', value: '2026', status: 'filled', required: true },
      { key: 'llm_institution', label: 'LLM', value: 'Tel Aviv University & UC Berkeley (Joint, 2013–2015)', status: 'filled', required: true },
      { key: 'llb_institution', label: 'LLB', value: 'Netanya Academic College (2001–2005)', status: 'filled', required: true },
      { key: 'bar_admission', label: 'רישיון עריכת דין', value: 'עו"ד ונוטריון — לשכת עוה"ד בישראל (2006); מגשר מוסמך', status: 'filled', required: false },
    ],
  },
  {
    title: 'ניסיון מקצועי',
    icon: Briefcase,
    fields: [
      { key: 'current_title', label: 'תפקיד נוכחי', value: 'Attorney, Legal Educator & AI Law Researcher', status: 'filled', required: true },
      { key: 'current_org', label: 'ארגון נוכחי', value: 'Lalum & Co. Law Firm + University of Córdoba (PhD)', status: 'filled', required: true },
      { key: 'years_exp', label: 'שנות ניסיון', value: '20+ שנות פרקטיקה משפטית', status: 'filled', required: true },
      { key: 'ai_exp', label: 'שנות ניסיון ב-AI Law', value: '5+ שנים (מחקר, הוראה, פרסומים)', status: 'filled', required: true },
      { key: 'policy_exp', label: 'ניסיון רגולטורי/Policy', value: 'סגן יו"ר לשכת עוה"ד (2015–2023) — רפורמות חקיקה עם משרד המשפטים', status: 'filled', required: false },
      { key: 'languages', label: 'שפות', value: 'עברית (שפת אם) · אנגלית (שוטפת — כתיבה אקדמית ומשפטית)', status: 'filled', required: true },
    ],
  },
  {
    title: 'מחקר ופרסומים',
    icon: BookOpen,
    fields: [
      { key: 'publications', label: 'פרסומים Peer-Reviewed', value: '2 מאמרים Scopus/JCR + עשרות מאמרים מקצועיים', status: 'filled', required: true },
      { key: 'top_journals', label: 'כתבי עת', value: 'Mathematics (MDPI) · SN Business & Economics (Springer)', status: 'filled', required: false },
      { key: 'books', label: 'ספרים', value: '5 ספרים: The Decision Room (2025), Urban Renewal (2025), TAMA 38 (2020) ועוד', status: 'filled', required: false },
      { key: 'research_focus', label: 'תחום מחקר', value: 'AI Law · Explainable AI · Algorithmic Risk Modeling · Autonomous Systems', status: 'filled', required: true },
      { key: 'ssrn_profile', label: 'ORCID / Google Scholar', value: 'ORCID: 0000-0001-6094-5303', status: 'partial', required: false, hint: 'הוסף קישור Google Scholar' },
    ],
  },
  {
    title: 'העדפות ועמדה',
    icon: MapPin,
    fields: [
      { key: 'target_roles', label: 'תפקידים מועדפים', value: 'Head AI Policy · Chief AI Ethics Officer · Senior AI Legal Counsel · Director AI Law', status: 'filled', required: true },
      { key: 'salary_ils', label: 'שכר מצופה (₪)', value: '45,000+ ₪/חודש', status: 'filled', required: true },
      { key: 'salary_usd', label: 'שכר מצופה ($)', value: '$200,000–$280,000/year', status: 'filled', required: true },
      { key: 'relocation', label: 'נכון לעבור?', value: 'כן — US, EU, UK, Germany, France, Spain', status: 'filled', required: true },
      { key: 'notice_period', label: 'תקופת הודעה', value: '60 ימים', status: 'filled', required: true },
      { key: 'work_type', label: 'סוג עבודה', value: 'Hybrid / Remote / On-site', status: 'filled', required: true },
    ],
  },
  {
    title: 'מסמכים',
    icon: FileText,
    fields: [
      { key: 'resume_docx', label: 'קורות חיים (DOCX)', value: 'Avraham_Lalum_CV_2026_EN.docx ✓ שמור ב-job_agent/', status: 'filled', required: true },
      { key: 'cover_letter', label: 'מכתב כוונות', value: 'תבנית מובנית ב-profile_context.json ✓', status: 'filled', required: true },
      { key: 'resume_pdf', label: 'גרסת PDF של ה-CV', value: 'resume.pdf ✓ שמור ב-job_agent/', status: 'filled', required: false },
      { key: 'academic_cv', label: 'Academic CV ארוך', value: '', status: 'missing', required: false, hint: 'גרסה מורחבת עם כל הפרסומים — נדרש ל-OECD/ECB/אקדמיה' },
      { key: 'references', label: 'ממליצים', value: '', status: 'missing', required: false, hint: '2–3 ממליצים — פרופסור מנחה, שופט, ראש לשכה' },
    ],
  },
];

// ─── Schedule config ────────────────────────────────────────────────────────

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

const defaultSchedule = [
  { day: 0, hour: 7, label: 'ראשון 07:00', active: true },
  { day: 2, hour: 7, label: 'שלישי 07:00', active: true },
  { day: 4, hour: 7, label: 'חמישי 07:00', active: true },
];

const autonomyRules = [
  {
    condition: 'ציון ≥ 9.5 + חברה ברשימת המאושרות',
    action: 'מגיש אוטומטית ללא שאלה',
    icon: Zap,
    color: 'text-green-400 bg-green-500/15 border-green-500/30',
    badge: 'אוטומטי',
  },
  {
    condition: 'ציון 8.0–9.4',
    action: 'שולח התראה + ממתין לאישורך ב-dashboard',
    icon: AlertCircle,
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    badge: 'אישור נדרש',
  },
  {
    condition: 'ציון < 8.0',
    action: 'מסנן אוטומטית, מוסיף ליומן בלבד',
    icon: XCircle,
    color: 'text-gray-500 bg-gray-800 border-gray-700',
    badge: 'דחיה אוטומטית',
  },
];

const approvedCompanies = ['Waymo', 'Tesla', 'Mercedes-Benz', 'ECB', 'OECD', 'Microsoft', 'EU AI Office', 'OpenAI', 'Wiz', 'Apple', 'Google', 'Pagaya'];

// ─── Score color ────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 9 ? 'text-green-400 bg-green-500/15 border-green-500/30'
  : s >= 8 ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  : 'text-red-400 bg-red-500/15 border-red-500/30';

const decisionStyle: Record<JobDecision, string> = {
  pending: 'border-gray-800 bg-[#13151f]',
  approved: 'border-green-500/40 bg-green-500/5',
  rejected: 'border-gray-700 bg-gray-900/40 opacity-60',
  applying: 'border-amber-500/40 bg-amber-500/5',
  applied: 'border-green-600/40 bg-green-600/5',
  failed: 'border-red-500/40 bg-red-500/5',
};

// ─── Tab labels ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'queue', label: 'תור משרות', icon: Briefcase },
  { id: 'schedule', label: 'לוח זמנים', icon: CalendarClock },
  { id: 'profile', label: 'פרופיל + קורות חיים', icon: User },
] as const;
type Tab = typeof TABS[number]['id'];

// ─── Main component ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'job-decisions-v1';

function loadDecisions(): Record<string, { decision: JobCandidate['decision']; appliedAt?: string }> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function saveDecision(id: string, decision: JobCandidate['decision'], appliedAt?: string) {
  const saved = loadDecisions();
  saved[id] = { decision, appliedAt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function mergeWithSaved(jobs: JobCandidate[]): JobCandidate[] {
  const saved = loadDecisions();
  return jobs.map(j => saved[j.id] ? { ...j, ...saved[j.id] } : j);
}

export function WorkerAgentView({ onBreadcrumbCeo }: WorkerAgentViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [jobs, setJobs] = useState<JobCandidate[]>(() => mergeWithSaved(initialJobQueue));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [confirmJob, setConfirmJob] = useState<JobCandidate | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const decide = (id: string, decision: 'approved' | 'rejected') => {
    if (decision === 'approved') {
      const job = jobs.find(j => j.id === id);
      if (job?.toEmail && job?.coverLetter) {
        setConfirmJob(job);
      } else {
        // No email configured — mark as approved for manual follow-up
        saveDecision(id, 'applied', 'ממתין לשליחה ידנית');
        setJobs(prev => prev.map(j => j.id === id ? { ...j, decision: 'applied', appliedAt: 'ממתין לשליחה ידנית' } : j));
      }
    } else {
      saveDecision(id, 'rejected');
      setJobs(prev => prev.map(j => j.id === id ? { ...j, decision: 'rejected' } : j));
    }
  };

  const confirmSend = async () => {
    if (!confirmJob) return;
    const job = confirmJob;

    // Basic email validation before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!job.toEmail || !emailRegex.test(job.toEmail)) {
      setSendError(`כתובת מייל לא תקינה: "${job.toEmail}" — בדוק לפני שליחה`);
      setConfirmJob(null);
      return;
    }

    setConfirmJob(null);
    setSendError(null);
    setApplyingId(job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, decision: 'applying' } : j));

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: job.toEmail,
          subject: job.emailSubject,
          cover_letter: job.coverLetter,
          company: job.company,
          title: job.title,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const appliedAt = new Date().toLocaleTimeString('he-IL');
        saveDecision(job.id, 'applied', appliedAt);
        setJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, decision: 'applied', appliedAt } : j
        ));
      } else {
        setSendError(data.error ?? 'שגיאה לא ידועה');
        saveDecision(job.id, 'failed');
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, decision: 'failed' } : j));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setSendError(msg);
      saveDecision(job.id, 'failed');
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, decision: 'failed' } : j));
    } finally {
      setApplyingId(null);
    }
  };

  const pending = jobs.filter(j => j.score >= 8 && j.decision === 'pending');
  const qualified = jobs.filter(j => j.score >= 8);
  const applied = jobs.filter(j => j.decision === 'applied');
  const lowScore = jobs.filter(j => j.score < 8);

  // Profile completeness
  const allFields = profileSections.flatMap(s => s.fields);
  const requiredFields = allFields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => f.status === 'filled');
  const missingRequired = requiredFields.filter(f => f.status === 'missing');
  const completeness = Math.round((filledRequired.length / requiredFields.length) * 100);

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Confirm Send Modal ─────────────────────────────────────────────── */}
      {confirmJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#13151f] border border-amber-500/40 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-end gap-2 mb-4">
              <h2 className="text-white font-bold text-lg">אישור שליחת בקשה</h2>
              <Send size={18} className="text-amber-400" />
            </div>
            <div className="space-y-3 mb-5">
              <div className="p-3 bg-gray-900 rounded-xl">
                <p className="text-gray-500 text-xs mb-1">חברה</p>
                <p className="text-white font-semibold">{confirmJob.company}</p>
              </div>
              <div className="p-3 bg-gray-900 rounded-xl">
                <p className="text-gray-500 text-xs mb-1">תפקיד</p>
                <p className="text-white">{confirmJob.title}</p>
              </div>
              <div className="p-3 bg-gray-900 rounded-xl">
                <p className="text-gray-500 text-xs mb-1">נשלח אל</p>
                <p className="text-amber-400 font-mono text-sm">{confirmJob.toEmail}</p>
              </div>
              <div className="p-3 bg-gray-900 rounded-xl">
                <p className="text-gray-500 text-xs mb-1">נושא</p>
                <p className="text-gray-300 text-sm">{confirmJob.emailSubject}</p>
              </div>
              <div className="p-3 bg-gray-900 rounded-xl max-h-40 overflow-y-auto">
                <p className="text-gray-500 text-xs mb-1">תצוגה מקדימה של מכתב הכיסוי</p>
                <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-line">{confirmJob.coverLetter?.slice(0, 400)}...</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmJob(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm font-medium hover:bg-gray-800 transition-all"
              >
                ביטול
              </button>
              <button
                onClick={confirmSend}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-all shadow-lg shadow-green-900/30"
              >
                <Send size={14} />
                שלח עכשיו דרך Outlook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Error Banner ──────────────────────────────────────────────── */}
      {sendError && (
        <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <button onClick={() => setSendError(null)} className="text-red-400 text-xs hover:text-red-300">✕ סגור</button>
          <div className="text-right">
            <p className="text-red-400 font-semibold text-sm">שגיאה בשליחה</p>
            <p className="text-gray-500 text-xs">{sendError}</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button onClick={onBreadcrumbCeo} className="hover:text-gray-400 transition-colors">
            אורי מנכ"ל
          </button>
          <ChevronRight size={12} />
          <span className="text-amber-400 font-medium">Worker — סוכן דרושים</span>
        </div>
        <div className="text-right">
          <h1 className="text-white font-bold text-2xl">Worker — סוכן דרושים</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            AI Law · Autonomous Systems · Policy · Governance · ד"ר כלכלה + משפטים
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'נסרקו', value: '19', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'מתאימות', value: String(qualified.length), icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'הוגשו', value: String(applied.length), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'פרופיל מלא', value: `${completeness}%`, icon: User, color: completeness < 50 ? 'text-red-400' : 'text-amber-400', bg: completeness < 50 ? 'bg-red-500/10' : 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-xl leading-none">{value}</p>
              <p className="text-gray-500 text-xs mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Profile incomplete warning */}
      {missingRequired.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors"
          >
            <span>השלם פרופיל</span>
            <ChevronRight size={14} />
          </button>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-red-400 font-semibold text-sm">{missingRequired.length} שדות חובה חסרים</p>
              <p className="text-gray-500 text-xs">Worker לא יוכל למלא טפסים ללא הפרטים האלה</p>
            </div>
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Pending approval banner */}
      {pending.length > 0 && activeTab !== 'queue' && (
        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <button onClick={() => setActiveTab('queue')} className="flex items-center gap-2 text-amber-400 text-sm hover:text-amber-300 transition-colors">
            <span>עבור לתור</span>
            <ChevronRight size={14} />
          </button>
          <div className="flex items-center gap-2 text-right">
            <p className="text-amber-400 text-sm">{pending.length} משרות ממתינות לאישורך</p>
            <AlertCircle size={16} className="text-amber-400" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-end gap-1 border-b border-gray-800 pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'queue' && pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pending.length}
              </span>
            )}
            {id === 'profile' && missingRequired.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {missingRequired.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Job Queue ────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-3">
            <h2 className="text-white font-semibold text-sm flex items-center justify-end gap-2">
              <span>תור המשרות ({qualified.length} מתאימות)</span>
              <Briefcase size={15} className="text-amber-400" />
            </h2>

            {qualified.map((job) => (
              <div id={`job-${job.id}`} key={job.id}
                className={`border rounded-xl transition-all ${decisionStyle[job.decision]}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg border text-center min-w-[54px] ${scoreColor(job.score)}`}>
                      <p className="text-lg font-bold leading-none">{job.score.toFixed(1)}</p>
                      <p className="text-xs opacity-70">/10</p>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          {job.decision === 'pending' && <span className="text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">ממתין לאישורך</span>}
                          {job.decision === 'applying' && <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full"><Loader2 size={10} className="animate-spin" /> מגיש...</span>}
                          {job.decision === 'applied' && <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> הוגש</span>}
                          {job.decision === 'rejected' && <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full"><XCircle size={10} /> דחית</span>}
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-sm">{job.title}</h3>
                          <div className="flex items-center justify-end gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-gray-300 text-xs font-medium"><Building2 size={11} />{job.company}</span>
                            <span className="flex items-center gap-1 text-gray-400 text-xs"><MapPin size={11} />{job.location}</span>
                            <span className="flex items-center gap-1 text-gray-400 text-xs"><DollarSign size={11} />{job.salary}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start justify-end gap-1.5 mt-2">
                        <p className="text-gray-500 text-xs leading-relaxed">{job.scoreReason}</p>
                        <Sparkles size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5 mt-2">
                        {job.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                            <Tag size={9} />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                    className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-center"
                  >
                    {expandedId === job.id ? '▲ סגור תיאור' : '▼ קרא תיאור מלא'}
                  </button>
                </div>

                {expandedId === job.id && (
                  <div className="px-4 pb-3 border-t border-gray-800/60">
                    <p className="text-gray-400 text-xs leading-relaxed mt-3 text-right">{job.description}</p>
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors">
                      <ExternalLink size={11} />פתח מודעה מקורית
                    </a>
                  </div>
                )}

                {job.decision === 'pending' && (
                  <div className="flex gap-2 px-4 pb-4 pt-1">
                    <button onClick={() => decide(job.id, 'rejected')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all">
                      <SkipForward size={14} />דלג
                    </button>
                    <button onClick={() => decide(job.id, 'approved')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all shadow-lg shadow-green-900/30">
                      <Send size={14} />אשר והגש
                    </button>
                  </div>
                )}
                {job.decision === 'applied' && (
                  <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-gray-800/40">
                    <span className="flex items-center gap-1 text-gray-600 text-xs"><Camera size={11} />screenshot נשמר</span>
                    <span className="text-green-400 text-xs">הוגש בהצלחה · {job.appliedAt}</span>
                  </div>
                )}
                {job.decision === 'applying' && (
                  <div className="px-4 pb-3 pt-1 border-t border-amber-500/20">
                    <div className="flex items-center justify-end gap-2 text-amber-400 text-xs">
                      <span>Playwright פותח דפדפן, ממלא טופס...</span>
                      <Loader2 size={12} className="animate-spin" />
                    </div>
                    <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full"
                        style={{ width: applyingId === job.id ? '100%' : '0%', transition: 'width 2.8s ease-in-out' }} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {lowScore.length > 0 && (
              <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
                <h3 className="text-gray-600 text-xs font-medium mb-3 text-right flex items-center justify-end gap-2">
                  <span>{lowScore.length} משרות סוננו אוטומטית (ציון &lt; 8)</span>
                  <XCircle size={13} />
                </h3>
                {lowScore.map(job => (
                  <div key={job.id} className="flex items-center gap-3 text-right opacity-40 mb-1.5">
                    <span className="text-xs text-red-400 font-mono">{job.score.toFixed(1)}</span>
                    <div className="flex-1">
                      <span className="text-gray-500 text-xs">{job.title}</span>
                      <span className="text-gray-700 text-xs"> — {job.company}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
                <span>Pipeline</span><BarChart3 size={14} className="text-purple-400" />
              </h2>
              {[
                { step: 'סריקת משרות', icon: Search, done: true, detail: '63 נמצאו (AI+Law)' },
                { step: 'ציון AI', icon: Brain, done: true, detail: `${qualified.length} מעל 8` },
                { step: 'אישור אנושי', icon: Shield, active: pending.length > 0, detail: `${pending.length} ממתינות` },
                { step: 'Playwright', icon: MousePointerClick, done: applied.length > 0, detail: `${applied.length} הוגשו` },
                { step: 'Screenshot', icon: Camera, done: applied.length > 0, detail: `${applied.length} נשמרו` },
              ].map(({ step, icon: Icon, done, active, detail }) => (
                <div key={step} className="flex items-center gap-2 mb-3 last:mb-0">
                  <div className="flex-1 text-right">
                    <p className={`text-xs font-medium ${done ? 'text-gray-400' : active ? 'text-white' : 'text-gray-600'}`}>{step}</p>
                    <p className="text-gray-600 text-xs">{detail}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500/15' : active ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-gray-800'}`}>
                    {done ? <CheckCircle2 size={13} className="text-green-400" />
                      : active ? <Loader2 size={13} className="text-amber-400 animate-spin" />
                      : <Icon size={13} className="text-gray-600" />}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
                <span>מודולים</span><ScrollText size={14} className="text-green-400" />
              </h2>
              {[
                { name: 'resume_parser', icon: FileText },
                { name: 'job_scorer', icon: Brain },
                { name: 'field_mapper', icon: ScrollText },
                { name: 'browser_apply', icon: MousePointerClick },
                { name: 'approval_flow', icon: Shield },
              ].map(({ name, icon: Icon }) => (
                <div key={name} className="flex items-center gap-2 mb-2 last:mb-0">
                  <p className="flex-1 text-right font-mono text-gray-500 text-xs">{name}.py</p>
                  <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center">
                    <Icon size={11} className="text-green-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Schedule ─────────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            {/* Weekly schedule */}
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
                <span>סריקה אוטומטית שבועית</span>
                <CalendarClock size={15} className="text-blue-400" />
              </h2>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {DAYS.map((day, i) => {
                  const slot = schedule.find(s => s.day === i);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (slot) {
                          setSchedule(prev => prev.map(s => s.day === i ? { ...s, active: !s.active } : s));
                        } else {
                          setSchedule(prev => [...prev, { day: i, hour: 7, label: `יום ${day} 07:00`, active: true }]);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        slot?.active
                          ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                          : 'border-gray-800 bg-gray-900/40 text-gray-600 hover:border-gray-700'
                      }`}
                    >
                      <span className="text-sm font-bold">{day}</span>
                      {slot?.active && <span className="text-xs">07:00</span>}
                      {slot?.active
                        ? <CheckCircle2 size={12} />
                        : <div className="w-3 h-3 rounded-full border border-gray-700" />
                      }
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <span className="text-blue-400 text-xs">כל ריצה: סריקה → ציון → התראה למשרות 8+ → המתנה לאישורך</span>
                <Clock size={14} className="text-blue-400 flex-shrink-0" />
              </div>
            </div>

            {/* Autonomy rules */}
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
                <span>כללי אוטונומיה — מתי Worker פועל לבד</span>
                <Zap size={15} className="text-amber-400" />
              </h2>
              <div className="space-y-3">
                {autonomyRules.map(({ condition, action, icon: Icon, color, badge }) => (
                  <div key={badge} className={`flex items-start gap-3 p-3 rounded-xl border ${color}`}>
                    <div className="flex-1 text-right">
                      <p className="text-white text-xs font-semibold mb-0.5">{condition}</p>
                      <p className="text-gray-400 text-xs">{action}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <Icon size={16} />
                      <span className="text-xs font-semibold whitespace-nowrap">{badge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-approved companies */}
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
                <span>חברות ברשימה לאוטו-אפליי (ציון ≥ 9.5)</span>
                <CheckCircle2 size={15} className="text-green-400" />
              </h2>
              <div className="flex flex-wrap justify-end gap-2">
                {approvedCompanies.map(company => (
                  <span key={company} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-medium">
                    <CheckCircle2 size={11} />
                    {company}
                  </span>
                ))}
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-gray-500 text-xs hover:border-gray-600 transition-colors">
                  + הוסף חברה
                </button>
              </div>
              <p className="text-gray-600 text-xs text-right mt-3">
                בכל שאר החברות — אפילו ציון 9.8 — Worker ישלח התראה וימתין לאישורך.
              </p>
            </div>
          </div>

          {/* Schedule sidebar */}
          <div className="space-y-4">
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
                <span>ריצה הבאה</span>
                <Clock size={14} className="text-blue-400" />
              </h3>
              <div className="text-center py-3">
                <p className="text-white text-2xl font-bold">ראשון</p>
                <p className="text-blue-400 text-lg font-semibold">07:00</p>
                <p className="text-gray-600 text-xs mt-1">בעוד ~3 ימים</p>
              </div>
              <div className="mt-3 space-y-1.5">
                {schedule.filter(s => s.active).map(s => (
                  <div key={s.day} className="flex items-center justify-between text-xs">
                    <span className="text-blue-400">{s.label}</span>
                    <CheckCircle2 size={11} className="text-green-400" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
                <span>מקורות סריקה</span>
                <Search size={14} className="text-purple-400" />
              </h3>
              {[
                { name: 'LinkedIn Jobs', active: true },
                { name: 'Indeed Global', active: true },
                { name: 'EU AI Office Jobs', active: true },
                { name: 'OECD Careers', active: true },
                { name: 'ECB Vacancies', active: true },
                { name: 'Academia.edu Jobs', active: false },
              ].map(({ name, active }) => (
                <div key={name} className="flex items-center justify-between mb-2 last:mb-0">
                  <span className={`w-4 h-4 rounded flex items-center justify-center ${active ? 'bg-green-500/20' : 'bg-gray-800'}`}>
                    {active ? <CheckCircle2 size={10} className="text-green-400" /> : <XCircle size={10} className="text-gray-600" />}
                  </span>
                  <span className={`text-xs ${active ? 'text-gray-400' : 'text-gray-700'}`}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Profile + CV ─────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          {/* Completeness bar */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs">{filledRequired.length}/{requiredFields.length} שדות חובה מלאים</span>
                <span className={`text-lg font-bold ${completeness < 40 ? 'text-red-400' : completeness < 70 ? 'text-amber-400' : 'text-green-400'}`}>
                  {completeness}%
                </span>
              </div>
              <p className="text-white font-semibold text-sm">שלמות הפרופיל</p>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completeness < 40 ? 'bg-red-500' : completeness < 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            {missingRequired.length > 0 && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs font-semibold mb-1 text-right">שדות חובה חסרים — Worker לא יוכל להגיש בלעדיהם:</p>
                <div className="flex flex-wrap justify-end gap-1.5 mt-1">
                  {missingRequired.map(f => (
                    <span key={f.key} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sections */}
          {profileSections.map(({ title, icon: SectionIcon, fields }) => (
            <div key={title} className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
                <span>{title}</span>
                <SectionIcon size={15} className="text-purple-400" />
              </h2>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      field.status === 'filled' ? 'border-green-500/20 bg-green-500/5'
                      : field.status === 'partial' ? 'border-amber-500/20 bg-amber-500/5'
                      : field.required ? 'border-red-500/20 bg-red-500/5'
                      : 'border-gray-800 bg-gray-900/40'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {field.status === 'filled' && <CheckCircle2 size={15} className="text-green-400" />}
                      {field.status === 'partial' && <AlertCircle size={15} className="text-amber-400" />}
                      {field.status === 'missing' && field.required && <XCircle size={15} className="text-red-400" />}
                      {field.status === 'missing' && !field.required && <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {field.required && field.status !== 'filled' && (
                          <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">חובה</span>
                        )}
                        <p className={`text-sm font-medium ${
                          field.status === 'filled' ? 'text-white'
                          : field.status === 'partial' ? 'text-amber-300'
                          : field.required ? 'text-red-300' : 'text-gray-500'
                        }`}>
                          {field.label}
                        </p>
                      </div>
                      {field.status === 'filled' || field.status === 'partial'
                        ? <p className="text-gray-400 text-xs mt-0.5">{field.value}</p>
                        : <p className="text-gray-600 text-xs mt-0.5 italic">{field.hint ?? 'לא מולא'}</p>
                      }
                    </div>

                    {/* Edit button */}
                    <button className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                      {field.key === 'resume_pdf' || field.key === 'academic_cv'
                        ? <Upload size={12} className="text-gray-400" />
                        : <Edit3 size={12} className="text-gray-400" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
