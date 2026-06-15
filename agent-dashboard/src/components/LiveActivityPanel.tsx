import { useState, useEffect } from 'react';
import {
  Search, Brain, CheckCircle2, AlertCircle,
  TrendingUp, Users, CalendarClock, Activity,
  ChevronRight,
} from 'lucide-react';

interface LiveEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  action: string;
  detail: string;
  time: string;
  type: 'scan' | 'score' | 'approve' | 'apply' | 'social' | 'analytics';
  status: 'running' | 'done' | 'waiting';
}

const SCAN_STEPS: LiveEvent[] = [
  { id: 'e1', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'סורק AllJobs', detail: 'חיפוש: "יועץ משפטי בינה מלאכותית"', time: '09:00:01', type: 'scan', status: 'done' },
  { id: 'e2', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'סורק Drushim', detail: 'חיפוש: "דירקטור משפטי טכנולוגיה"', time: '09:00:18', type: 'scan', status: 'done' },
  { id: 'e3', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'סורק LinkedIn Israel', detail: 'AI law policy director · Israel', time: '09:00:35', type: 'scan', status: 'done' },
  { id: 'e4', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'סורק Indeed', detail: 'autonomous vehicles legal counsel · Remote', time: '09:01:02', type: 'scan', status: 'done' },
  { id: 'e5', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'מציין עם Claude AI', detail: 'מעריך 47 משרות ייחודיות...', time: '09:01:30', type: 'score', status: 'done' },
  { id: 'e6', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: '✓ Waymo — 9.8/10', detail: 'Head of AI Policy & Autonomous Systems Law', time: '09:02:05', type: 'score', status: 'done' },
  { id: 'e7', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: '✓ Tesla — 9.5/10', detail: 'Senior Counsel — AI Ethics & Product Law', time: '09:02:12', type: 'score', status: 'done' },
  { id: 'e8', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: '✓ ECB — 9.2/10', detail: 'AI Governance Lead — Financial Regulation', time: '09:02:19', type: 'score', status: 'done' },
  { id: 'e9', agentId: 'worker', agentName: 'Worker', agentAvatar: 'W', action: 'ממתין לאישורך', detail: '7 משרות מעל ציון 8 — בקש אישור לפני הגשה', time: '09:02:45', type: 'approve', status: 'waiting' },
];

const OTHER_EVENTS: LiveEvent[] = [
  { id: 'oe1', agentId: 'social', agentName: 'עידית', agentAvatar: 'ע', action: 'פרסמה LinkedIn', detail: '"AI & Law — פוסט מקצועי" · 212 רואים', time: '09:05', type: 'social', status: 'done' },
  { id: 'oe2', agentId: 'content', agentName: 'Content', agentAvatar: 'C', action: 'כתב פוסט', detail: 'טיוטה חדשה: "בינה מלאכותית ומשפט" ב-Telegram', time: '09:08', type: 'social', status: 'done' },
  { id: 'oe3', agentId: 'analytics', agentName: 'Analytics', agentAvatar: 'A', action: 'דו"ח שבועי', detail: 'תנועה +18% · המשרה המובילה: Waymo 9.8', time: '09:10', type: 'analytics', status: 'done' },
];

const typeStyle: Record<LiveEvent['type'], string> = {
  scan:      'text-blue-400 bg-blue-500/10',
  score:     'text-purple-400 bg-purple-500/10',
  approve:   'text-amber-400 bg-amber-500/10',
  apply:     'text-green-400 bg-green-500/10',
  social:    'text-pink-400 bg-pink-500/10',
  analytics: 'text-cyan-400 bg-cyan-500/10',
};

const typeIcon: Record<LiveEvent['type'], typeof Search> = {
  scan:      Search,
  score:     Brain,
  approve:   AlertCircle,
  apply:     CheckCircle2,
  social:    Users,
  analytics: TrendingUp,
};

interface LiveActivityPanelProps {
  onGoToWorker?: () => void;
}

export function LiveActivityPanel({ onGoToWorker }: LiveActivityPanelProps) {
  const [visibleCount, setVisibleCount] = useState(3);
  // Animate steps appearing
  useEffect(() => {
    if (visibleCount >= SCAN_STEPS.length) return;
    const t = setTimeout(() => setVisibleCount(v => v + 1), 900);
    return () => clearTimeout(t);
  }, [visibleCount]);

  const allEvents = [...SCAN_STEPS.slice(0, visibleCount), ...OTHER_EVENTS];
  const lastStep = SCAN_STEPS[visibleCount - 1];
  const isScanning = visibleCount < SCAN_STEPS.length;

  return (
    <div className="bg-[#0e1018] border border-gray-800 rounded-xl overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#13151f]">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-green-400" />
          <span className="text-gray-300 text-sm font-medium">פעילות חיה</span>
          <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <CalendarClock size={12} />
          <span>היום 09:00</span>
        </div>
      </div>

      {/* Worker status bar */}
      <div
        onClick={onGoToWorker}
        className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gradient-to-l from-purple-500/5 to-transparent cursor-pointer hover:from-purple-500/10 transition-all group"
      >
        <div className="flex items-center gap-1.5 text-purple-400 text-xs group-hover:text-purple-300">
          <span>פתח Worker</span>
          <ChevronRight size={12} />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-white text-sm font-semibold">Worker — סוכן דרושים</div>
            <div className="text-gray-500 text-xs">
              {isScanning
                ? `${lastStep?.action || 'מתחיל...'}`
                : '7 משרות ממתינות לאישורך'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
            W
          </div>
        </div>
      </div>

      {/* Pending approvals */}
      {!isScanning && (
        <div className="px-4 py-3 border-b border-gray-800 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onGoToWorker}
              className="text-amber-400 text-xs hover:text-amber-300 flex items-center gap-1"
            >
              אשר / דחה <ChevronRight size={11} />
            </button>
            <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              7 ממתינות לאישור
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { co: 'Waymo', title: 'Head of AI Policy', score: 9.8 },
              { co: 'Tesla', title: 'Senior AI Counsel', score: 9.5 },
              { co: 'ECB', title: 'AI Governance Lead', score: 9.2 },
            ].map(j => (
              <div key={j.co} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${j.score >= 9.5 ? 'text-green-400 bg-green-500/15' : 'text-amber-400 bg-amber-500/15'}`}>
                  {j.score}
                </span>
                <div className="text-right">
                  <span className="text-gray-300 text-xs">{j.title}</span>
                  <span className="text-gray-600 text-xs"> · {j.co}</span>
                </div>
              </div>
            ))}
            <div className="text-gray-600 text-xs text-right">+ 4 נוספות...</div>
          </div>
        </div>
      )}

      {/* Event log */}
      <div className="divide-y divide-gray-800/60 max-h-72 overflow-y-auto">
        {allEvents.map((ev, i) => {
          const Icon = typeIcon[ev.type];
          const isLast = i === visibleCount - 1 && isScanning;
          return (
            <div
              key={ev.id}
              className={`flex items-start gap-3 px-4 py-2.5 transition-all ${isLast ? 'bg-purple-500/5' : ''}`}
            >
              <span className="text-gray-700 text-xs mt-0.5 min-w-[42px] text-left">{ev.time}</span>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${typeStyle[ev.type]}`}>
                {isLast
                  ? <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  : <Icon size={12} />}
              </div>
              <div className="flex-1 text-right min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600 text-xs">{ev.agentName}</span>
                  <span className="text-gray-200 text-xs font-medium truncate">{ev.action}</span>
                </div>
                <p className="text-gray-500 text-xs truncate">{ev.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
