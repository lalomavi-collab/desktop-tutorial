import { useState } from 'react';
import {
  Briefcase, Search, Brain, MousePointerClick, CheckCircle2,
  XCircle, Clock, FileText, User, MapPin, DollarSign, Link,
  AlertCircle, Loader2, Camera, ScrollText, ChevronRight,
  Shield, ExternalLink, Tag, Building2, Send, SkipForward,
  Sparkles, BarChart3,
} from 'lucide-react';
import { initialJobQueue } from '../data/mockData';
import type { JobCandidate, JobDecision } from '../types';

interface WorkerAgentViewProps {
  onBreadcrumbCeo?: () => void;
}

const profilePreview = [
  { label: 'תואר', value: 'ד"ר כלכלה + משפטים', icon: FileText },
  { label: 'מיקום', value: 'תל אביב / פתוח לגלובלי', icon: MapPin },
  { label: 'שכר מצופה', value: '$200K+ / ₪45K+', icon: DollarSign },
  { label: 'תחום', value: 'AI Law · Autonomous Systems · Governance', icon: Briefcase },
  { label: 'LinkedIn', value: 'linkedin.com/in/...', icon: Link },
  { label: 'זמינות', value: '30 יום', icon: Clock },
];

const scoreColor = (s: number) =>
  s >= 9 ? 'text-green-400 bg-green-500/15 border-green-500/30'
  : s >= 8 ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  : 'text-red-400 bg-red-500/15 border-red-500/30';

const decisionStyle: Record<JobDecision, string> = {
  pending: '',
  approved: 'border-green-500/40 bg-green-500/5',
  rejected: 'border-red-500/30 bg-red-500/5 opacity-60',
  applying: 'border-amber-500/40 bg-amber-500/5',
  applied: 'border-green-600/40 bg-green-600/5',
  failed: 'border-red-500/40 bg-red-500/5',
};

export function WorkerAgentView({ onBreadcrumbCeo }: WorkerAgentViewProps) {
  const [jobs, setJobs] = useState<JobCandidate[]>(initialJobQueue);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const decide = (id: string, decision: 'approved' | 'rejected') => {
    if (decision === 'approved') {
      // Simulate applying
      setApplyingId(id);
      setJobs(prev => prev.map(j => j.id === id ? { ...j, decision: 'applying' } : j));
      setTimeout(() => {
        setJobs(prev => prev.map(j =>
          j.id === id ? { ...j, decision: 'applied', appliedAt: 'עכשיו', screenshotPath: `screenshots/${id}.png` } : j
        ));
        setApplyingId(null);
      }, 2800);
    } else {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, decision: 'rejected' } : j));
    }
  };

  const pending = jobs.filter(j => j.score >= 8 && j.decision === 'pending');
  const qualified = jobs.filter(j => j.score >= 8);
  const applied = jobs.filter(j => j.decision === 'applied');
  const lowScore = jobs.filter(j => j.score < 8);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Breadcrumb + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <button
            onClick={onBreadcrumbCeo}
            className="hover:text-gray-400 transition-colors"
          >
            אורי מנכ"ל
          </button>
          <ChevronRight size={12} />
          <span className="text-amber-400 font-medium">Worker — סוכן דרושים</span>
        </div>
        <div className="text-right">
          <h1 className="text-white font-bold text-2xl">Worker — סוכן דרושים</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            סרק 63 משרות AI+Law · LinkedIn · Waymo · Tesla · ECB · OECD · ממתין לאישורך
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'נסרקו', value: '63', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'ציון 8+', value: String(qualified.length), icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'הוגשו', value: String(applied.length), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'ממתין לאישור', value: String(pending.length), icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
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

      {/* Approval required banner */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <button
            onClick={() => {
              const first = pending[0];
              setExpandedId(first.id);
              document.getElementById(`job-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="flex items-center gap-2 text-amber-400 text-sm font-medium hover:text-amber-300 transition-colors"
          >
            <span>עבור לתור האישור</span>
            <ChevronRight size={15} />
          </button>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-amber-400 font-semibold text-sm">
                {pending.length} משרה{pending.length > 1 ? 'ות' : ''} מחכות לאישורך
              </p>
              <p className="text-gray-400 text-xs">Worker לא יגיש בקשה ללא אישורך המפורש</p>
            </div>
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Job Queue — main column */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-white font-semibold text-sm flex items-center justify-end gap-2">
            <span>תור המשרות ({qualified.length} מתאימות)</span>
            <Briefcase size={15} className="text-amber-400" />
          </h2>

          {qualified.map((job) => (
            <div
              id={`job-${job.id}`}
              key={job.id}
              className={`border rounded-xl transition-all ${decisionStyle[job.decision] || 'border-gray-800 bg-[#13151f]'}`}
            >
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Score badge */}
                  <div className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg border text-center min-w-[54px] ${scoreColor(job.score)}`}>
                    <p className="text-lg font-bold leading-none">{job.score.toFixed(1)}</p>
                    <p className="text-xs opacity-70">/10</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-right">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        {/* Decision badge */}
                        {job.decision === 'pending' && (
                          <span className="text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            ממתין לאישורך
                          </span>
                        )}
                        {job.decision === 'applying' && (
                          <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full">
                            <Loader2 size={10} className="animate-spin" /> מגיש...
                          </span>
                        )}
                        {job.decision === 'applied' && (
                          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> הוגש
                          </span>
                        )}
                        {job.decision === 'rejected' && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-500/15 border border-gray-700 px-2 py-0.5 rounded-full">
                            <XCircle size={10} /> דחית
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">{job.title}</h3>
                        <div className="flex items-center justify-end gap-3 mt-1">
                          <span className="flex items-center gap-1 text-gray-400 text-xs">
                            <Clock size={11} />{job.scannedAt}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400 text-xs">
                            <DollarSign size={11} />{job.salary}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400 text-xs">
                            <MapPin size={11} />{job.location}
                          </span>
                          <span className="flex items-center gap-1 text-gray-300 text-xs font-medium">
                            <Building2 size={11} />{job.company}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI reason */}
                    <div className="flex items-start justify-end gap-1.5 mt-2">
                      <p className="text-gray-500 text-xs leading-relaxed">{job.scoreReason}</p>
                      <Sparkles size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap justify-end gap-1.5 mt-2">
                      {job.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                          <Tag size={9} />{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-center"
                >
                  {expandedId === job.id ? '▲ סגור תיאור' : '▼ קרא תיאור מלא'}
                </button>
              </div>

              {/* Expanded description */}
              {expandedId === job.id && (
                <div className="px-4 pb-3 border-t border-gray-800/60">
                  <p className="text-gray-400 text-xs leading-relaxed mt-3 text-right">{job.description}</p>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
                  >
                    <ExternalLink size={11} />
                    פתח מודעה מקורית
                  </a>
                </div>
              )}

              {/* Action buttons — only for pending */}
              {job.decision === 'pending' && (
                <div className="flex gap-2 px-4 pb-4 pt-1">
                  <button
                    onClick={() => decide(job.id, 'rejected')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all"
                  >
                    <SkipForward size={14} />
                    דלג
                  </button>
                  <button
                    onClick={() => decide(job.id, 'approved')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all shadow-lg shadow-green-900/30"
                  >
                    <Send size={14} />
                    אשר והגש
                  </button>
                </div>
              )}

              {/* Applied confirmation */}
              {job.decision === 'applied' && (
                <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-gray-800/40">
                  <span className="flex items-center gap-1 text-gray-600 text-xs">
                    <Camera size={11} />
                    screenshot נשמר
                  </span>
                  <span className="text-green-400 text-xs">בקשה הוגשה בהצלחה · {job.appliedAt}</span>
                </div>
              )}

              {/* Applying spinner */}
              {job.decision === 'applying' && (
                <div className="px-4 pb-3 pt-1 border-t border-amber-500/20">
                  <div className="flex items-center justify-end gap-2 text-amber-400 text-xs">
                    <span>Playwright פותח דפדפן, ממלא טופס...</span>
                    <Loader2 size={12} className="animate-spin" />
                  </div>
                  <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full animate-[grow_2.8s_ease-in-out_forwards]"
                      style={{ width: applyingId === job.id ? '100%' : '0%', transition: 'width 2.8s ease-in-out' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Low score jobs */}
          {lowScore.length > 0 && (
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
              <h3 className="text-gray-600 text-xs font-medium mb-3 text-right flex items-center justify-end gap-2">
                <span>{lowScore.length} משרות נסוננו אוטומטית (ציון &lt; 8)</span>
                <XCircle size={13} />
              </h3>
              <div className="space-y-1.5">
                {lowScore.map(job => (
                  <div key={job.id} className="flex items-center gap-3 text-right opacity-50">
                    <span className="text-xs text-red-400 font-mono">{job.score.toFixed(1)}</span>
                    <div className="flex-1">
                      <span className="text-gray-500 text-xs">{job.title}</span>
                      <span className="text-gray-700 text-xs"> — {job.company}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Pipeline */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
            <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-end gap-2">
              <span>Pipeline</span>
              <BarChart3 size={14} className="text-purple-400" />
            </h2>
            {[
              { step: 'סריקת משרות', icon: Search, done: true, detail: '63 נמצאו (AI+Law)' },
              { step: 'ציון AI', icon: Brain, done: true, detail: `${qualified.length} מעל 8` },
              { step: 'אישור אנושי', icon: Shield, active: pending.length > 0, detail: `${pending.length} ממתינות` },
              { step: 'Playwright', icon: MousePointerClick, done: applied.length > 0, detail: `${applied.length} הוגשו` },
              { step: 'צילום אישור', icon: Camera, done: applied.length > 0, detail: `${applied.length} screenshots` },
            ].map(({ step, icon: Icon, done, active, detail }) => (
              <div key={step} className="flex items-center gap-2 mb-3 last:mb-0">
                <div className="flex-1 text-right">
                  <p className={`text-xs font-medium ${done ? 'text-gray-400' : active ? 'text-white' : 'text-gray-600'}`}>{step}</p>
                  <p className="text-gray-600 text-xs">{detail}</p>
                </div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-green-500/15' : active ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-gray-800'
                }`}>
                  {done ? <CheckCircle2 size={13} className="text-green-400" />
                  : active ? <Loader2 size={13} className="text-amber-400 animate-spin" />
                  : <Icon size={13} className="text-gray-600" />}
                </div>
              </div>
            ))}
          </div>

          {/* Modules */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
            <h2 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
              <span>מודולים</span>
              <ScrollText size={14} className="text-green-400" />
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

          {/* Profile snapshot */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
            <h2 className="text-white font-semibold text-sm mb-3 flex items-center justify-end gap-2">
              <span>פרופיל מועמד</span>
              <User size={14} className="text-amber-400" />
            </h2>
            <div className="space-y-2">
              {profilePreview.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-[#0f1117] border border-gray-800/60">
                  <p className="flex-1 text-right">
                    <span className="text-gray-400 text-xs">{value}</span>
                  </p>
                  <p className="text-gray-600 text-xs">{label}</p>
                  <Icon size={12} className="text-gray-600 flex-shrink-0" />
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 bg-gray-900 rounded-lg">
              <p className="text-green-400 font-mono text-xs leading-relaxed">
                python -m job_agent.main<br />
                {'  '}--jobs sample_jobs.json<br />
                {'  '}--resume resume.pdf --headed
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
