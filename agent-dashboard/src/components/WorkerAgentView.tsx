import {
  Briefcase, Search, Brain, MousePointerClick, CheckCircle2,
  XCircle, Clock, FileText, User, MapPin, DollarSign, Link,
  AlertCircle, Loader2, Camera, ScrollText,
  ChevronRight, BarChart3, Shield
} from 'lucide-react';
interface WorkerAgentViewProps {
  agent: { id: string; name: string };
}

const recentDecisions = [
  { title: 'Senior AI Engineer', company: 'TechVision AI', score: 9.2, decision: 'applied', time: 'לפני 12 דקות', screenshot: true },
  { title: 'Machine Learning Lead', company: 'FinAI Ltd', score: 8.7, decision: 'applied', time: 'לפני 28 דקות', screenshot: true },
  { title: 'AI Product Manager', company: 'ScaleUp', score: 7.4, decision: 'skipped_score', time: 'לפני 45 דקות', screenshot: false },
  { title: 'Junior Data Analyst', company: 'DataCo', score: 3.1, decision: 'skipped_score', time: 'לפני שעה', screenshot: false },
  { title: 'NLP Research Lead', company: 'DeepMind Israel', score: 9.6, decision: 'rejected_human', time: 'לפני יומיים', screenshot: false },
];

const pipeline = [
  { step: 'סריקת משרות', icon: Search, status: 'done', detail: '47 משרות נמצאו' },
  { step: 'ציון AI', icon: Brain, status: 'done', detail: '5 מעל ציון 8' },
  { step: 'אישור אנושי', icon: Shield, status: 'active', detail: '2 ממתינות לאישורך' },
  { step: 'מילוי טופס', icon: MousePointerClick, status: 'waiting', detail: 'Playwright' },
  { step: 'שליחה + צילום', icon: Camera, status: 'waiting', detail: 'Screenshot נשמר' },
];

const modules = [
  { name: 'Profile Context', file: 'profile_context.json', icon: User, status: 'active', detail: 'פרטים + תשובות סינון' },
  { name: 'Resume Parser', file: 'resume_parser.py', icon: FileText, status: 'active', detail: 'pdfplumber + pypdf' },
  { name: 'Job Scorer', file: 'job_scorer.py', icon: Brain, status: 'active', detail: 'LLM ציון 1–10' },
  { name: 'Field Mapper', file: 'field_mapper.py', icon: ScrollText, status: 'active', detail: 'LLM מיפוי שדות' },
  { name: 'Browser Apply', file: 'browser_apply.py', icon: MousePointerClick, status: 'active', detail: 'Playwright auto-fill' },
  { name: 'Approval Flow', file: 'approval_flow.py', icon: Shield, status: 'active', detail: 'Human-in-the-loop CLI' },
];

const profilePreview = [
  { label: 'שם', value: '[שמך]', icon: User },
  { label: 'מיקום', value: 'תל אביב, ישראל', icon: MapPin },
  { label: 'שכר מצופה', value: '35,000 ₪', icon: DollarSign },
  { label: 'LinkedIn', value: 'linkedin.com/in/...', icon: Link },
  { label: 'GitHub', value: 'github.com/...', icon: Link },
  { label: 'זמינות', value: '30 יום', icon: Clock },
];

function StatusBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score.toFixed(1)}/10
    </span>
  );
}

function DecisionIcon({ decision }: { decision: string }) {
  if (decision === 'applied') return <CheckCircle2 size={14} className="text-green-400" />;
  if (decision === 'rejected_human') return <XCircle size={14} className="text-yellow-400" />;
  return <XCircle size={14} className="text-gray-500" />;
}

function DecisionLabel({ decision }: { decision: string }) {
  if (decision === 'applied') return <span className="text-green-400 text-xs">הוגש</span>;
  if (decision === 'rejected_human') return <span className="text-yellow-400 text-xs">דחית</span>;
  return <span className="text-gray-500 text-xs">ציון נמוך</span>;
}

export function WorkerAgentView({ agent: _agent }: WorkerAgentViewProps) {
  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-600 text-xs">
          <span>לוח בקרה</span>
          <ChevronRight size={12} />
          <span className="text-amber-400">Worker — סוכן דרושים</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-2xl">Worker — סוכן דרושים אוטונומי</h1>
          <p className="text-gray-500 text-sm mt-0.5">סריקה · ציון · אישור אנושי · מילוי טופס · שליחה</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'משרות נסרקו', value: '47', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'עברו סף 8', value: '5', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'הוגשו', value: '2', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'צילומי מסך', value: '2', icon: Camera, color: 'text-amber-400', bg: 'bg-amber-500/10' },
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

      <div className="grid grid-cols-3 gap-5">
        {/* Pipeline */}
        <div className="col-span-1 bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
            <span>Pipeline נוכחי</span>
            <BarChart3 size={15} className="text-purple-400" />
          </h2>
          <div className="space-y-3">
            {pipeline.map(({ step, icon: Icon, status, detail }, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex-1 text-right">
                  <p className={`text-xs font-medium ${status === 'done' ? 'text-gray-400' : status === 'active' ? 'text-white' : 'text-gray-600'}`}>
                    {step}
                  </p>
                  <p className="text-gray-600 text-xs">{detail}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  status === 'done' ? 'bg-green-500/15' :
                  status === 'active' ? 'bg-amber-500/15 ring-1 ring-amber-500/40' :
                  'bg-gray-800'
                }`}>
                  {status === 'done'
                    ? <CheckCircle2 size={14} className="text-green-400" />
                    : status === 'active'
                    ? <Loader2 size={14} className="text-amber-400 animate-spin" />
                    : <Icon size={14} className="text-gray-600" />
                  }
                </div>
                {i < pipeline.length - 1 && (
                  <div className="absolute" />
                )}
              </div>
            ))}
          </div>

          {/* Approval pending alert */}
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center justify-end gap-2 mb-1">
              <p className="text-amber-400 text-xs font-semibold">ממתין לאישורך</p>
              <AlertCircle size={13} className="text-amber-400" />
            </div>
            <p className="text-gray-400 text-xs">2 משרות עם ציון {'>'}8 מחכות ל-y/n שלך ב-CLI</p>
          </div>
        </div>

        {/* Recent decisions */}
        <div className="col-span-2 bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
            <span>היסטוריית פעולות</span>
            <Briefcase size={15} className="text-blue-400" />
          </h2>
          <div className="space-y-2">
            {recentDecisions.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0f1117] border border-gray-800/60 hover:border-gray-700 transition-colors">
                <div className="flex-shrink-0">
                  <DecisionIcon decision={d.decision} />
                </div>
                <div className="flex-1 grid grid-cols-4 gap-2 items-center text-right">
                  <div className="col-span-2">
                    <p className="text-white text-xs font-medium">{d.title}</p>
                    <p className="text-gray-500 text-xs">{d.company}</p>
                  </div>
                  <div className="text-left">
                    <StatusBadge score={d.score} />
                  </div>
                  <div className="text-left">
                    <DecisionLabel decision={d.decision} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.screenshot && (
                    <span title="צילום מסך נשמר">
                      <Camera size={12} className="text-gray-500" />
                    </span>
                  )}
                  <p className="text-gray-600 text-xs">{d.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Modules */}
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
            <span>מודולים</span>
            <ScrollText size={15} className="text-green-400" />
          </h2>
          <div className="space-y-2">
            {modules.map(({ name, file, icon: Icon, detail }) => (
              <div key={name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/40 transition-colors">
                <div className="flex-1 text-right">
                  <p className="text-white text-xs font-medium">{name}</p>
                  <p className="text-gray-600 text-xs font-mono">{file}</p>
                </div>
                <p className="text-gray-500 text-xs">{detail}</p>
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={13} className="text-green-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile preview */}
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
            <span>פרופיל מועמד</span>
            <User size={15} className="text-amber-400" />
          </h2>
          <div className="space-y-2 mb-4">
            {profilePreview.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0f1117] border border-gray-800/60">
                <div className="flex-1 text-right">
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="text-white text-xs font-medium">{value}</p>
                </div>
                <Icon size={14} className="text-gray-600 flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Run commands */}
          <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-gray-500 text-xs mb-2 text-right">הפעלה מהירה</p>
            <code className="text-xs text-green-400 font-mono block leading-relaxed">
              # דמו ללא CV<br/>
              python -m job_agent.main --demo --dry-run<br/>
              <br/>
              # ריצה מלאה<br/>
              python -m job_agent.main \<br/>
              {'  '}--jobs sample_jobs.json \<br/>
              {'  '}--resume resume.pdf --headed
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
