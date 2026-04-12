import {
  Bot, Crown, CheckCircle2, Loader2, Clock, Zap,
  TrendingUp, Activity, Tag, AlertCircle, Play, Pause,
  ChevronRight, BarChart2, Timer, Wifi,
} from 'lucide-react';
import type { Agent } from '../types';

interface GenericAgentDetailProps {
  agent: Agent;
  allAgents: Agent[];
  onSelectAgent: (id: string) => void;
}

const statusConfig = {
  active: { label: 'פעיל',   color: 'text-green-400',  bg: 'bg-green-500/10',  dot: 'bg-green-500',  icon: Play },
  idle:   { label: 'ממתין',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', icon: Clock },
  paused: { label: 'מושהה', color: 'text-gray-400',   bg: 'bg-gray-500/10',   dot: 'bg-gray-500',   icon: Pause },
  error:  { label: 'שגיאה', color: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-500',    icon: AlertCircle },
};

const colorAccent: Record<string, { ring: string; bg: string; text: string; bar: string }> = {
  gold:    { ring: 'ring-yellow-400/40', bg: 'bg-yellow-500/10', text: 'text-yellow-300', bar: 'bg-yellow-400' },
  purple:  { ring: 'ring-purple-400/40', bg: 'bg-purple-500/10', text: 'text-purple-300', bar: 'bg-purple-400' },
  blue:    { ring: 'ring-blue-400/40',   bg: 'bg-blue-500/10',   text: 'text-blue-300',   bar: 'bg-blue-400' },
  orange:  { ring: 'ring-orange-400/40', bg: 'bg-orange-500/10', text: 'text-orange-300', bar: 'bg-orange-400' },
  teal:    { ring: 'ring-teal-400/40',   bg: 'bg-teal-500/10',   text: 'text-teal-300',   bar: 'bg-teal-400' },
  green:   { ring: 'ring-green-400/40',  bg: 'bg-green-500/10',  text: 'text-green-300',  bar: 'bg-green-400' },
  red:     { ring: 'ring-red-400/40',    bg: 'bg-red-500/10',    text: 'text-red-300',    bar: 'bg-red-400' },
  cyan:    { ring: 'ring-cyan-400/40',   bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   bar: 'bg-cyan-400' },
  default: { ring: 'ring-gray-600',      bg: 'bg-gray-700/30',   text: 'text-gray-300',   bar: 'bg-gray-400' },
};

function MetricCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} className={color} />
        <span className={`text-xl font-bold ${color}`}>{value}</span>
      </div>
      <p className="text-gray-400 text-xs text-right font-medium">{label}</p>
      {sub && <p className="text-gray-600 text-xs text-right mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export function GenericAgentDetail({ agent, allAgents, onSelectAgent }: GenericAgentDetailProps) {
  const st = statusConfig[agent.status];
  const ac = colorAccent[agent.color ?? 'default'];
  const parent = agent.parent ? allAgents.find(a => a.id === agent.parent) : null;
  const children = allAgents.filter(a => a.parent === agent.id);
  const m = agent.metrics;

  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        {/* Breadcrumb */}
        {parent && (
          <button
            onClick={() => onSelectAgent(parent.id)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs transition-colors mt-1"
          >
            <ChevronRight size={12} />
            {parent.name.split(' ')[0]}
          </button>
        )}
        <div className="flex-1 text-right">
          <div className="flex items-center gap-3 justify-end mb-1">
            <div>
              <h1 className="text-white font-bold text-2xl">{agent.name}</h1>
              {agent.role && <p className="text-gray-500 text-sm">{agent.role}</p>}
            </div>
            <div className={`w-14 h-14 rounded-2xl ${ac.bg} ring-2 ${ac.ring} flex items-center justify-center`}>
              {agent.type === 'ceo' ? (
                <Crown size={26} className={ac.text} />
              ) : (
                <Bot size={24} className={ac.text} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status + description */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5 flex items-start gap-4">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${st.color} ${st.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
          {st.label}
        </div>
        <p className="text-gray-400 text-sm leading-relaxed flex-1">{agent.description}</p>
      </div>

      {/* Metrics grid */}
      {m && (
        <div>
          <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">ביצועים</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="אחוז הצלחה"
              value={`${m.successRate}%`}
              icon={TrendingUp}
              color="text-green-400"
            />
            <MetricCard
              label="זמינות"
              value={`${m.uptime}%`}
              icon={Wifi}
              color="text-blue-400"
            />
            <MetricCard
              label="זמן ממוצע למשימה"
              value={m.avgTaskDuration}
              icon={Timer}
              color="text-orange-400"
            />
            <MetricCard
              label="משימות השבוע"
              value={m.tasksThisWeek}
              icon={BarChart2}
              color="text-purple-400"
            />
          </div>

          {/* Success & uptime bars */}
          <div className="mt-3 bg-[#13151f] border border-gray-800 rounded-xl p-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400 font-medium">{m.successRate}%</span>
                <span className="text-gray-500">אחוז הצלחה</span>
              </div>
              <ProgressBar value={m.successRate} color={ac.bar} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-400 font-medium">{m.uptime}%</span>
                <span className="text-gray-500">זמינות</span>
              </div>
              <ProgressBar value={m.uptime} color="bg-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* Tasks summary */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold text-sm mb-4">סטטוס משימות</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-white font-bold text-lg">{agent.tasksCompleted.toLocaleString()}</span>
            </div>
            <p className="text-gray-500 text-xs">הושלמו</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Loader2 size={16} className={`text-blue-400 ${agent.tasksRunning > 0 ? 'animate-spin' : ''}`} />
              <span className="text-white font-bold text-lg">{agent.tasksRunning}</span>
            </div>
            <p className="text-gray-500 text-xs">בריצה</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock size={16} className="text-yellow-400" />
              <span className="text-white font-bold text-lg">{agent.tasksQueue ?? 0}</span>
            </div>
            <p className="text-gray-500 text-xs">בתור</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-gray-600 text-xs">
          <span>פעיל לאחרונה: {agent.lastActive}</span>
          <Activity size={12} />
        </div>
      </div>

      {/* Skills */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-end gap-2 mb-3">
            <h2 className="text-white font-semibold text-sm">יכולות</h2>
            <Tag size={14} className="text-gray-500" />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {agent.skills.map(skill => (
              <span
                key={skill}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ac.bg} ${ac.text} border border-current/20`}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cost this month */}
      {m?.costThisMonth !== undefined && (
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div className="text-left">
            <span className="text-white font-bold">${m.costThisMonth.toFixed(2)}</span>
            <p className="text-gray-600 text-xs">החודש</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs font-medium">עלות API</p>
            {m.tokensUsed && (
              <p className="text-gray-600 text-xs">{(m.tokensUsed / 1000).toFixed(0)}K טוקנים</p>
            )}
          </div>
        </div>
      )}

      {/* Sub-agents */}
      {children.length > 0 && (
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-end gap-2 mb-4">
            <h2 className="text-white font-semibold text-sm">סוכנים כפופים ({children.length})</h2>
            <Zap size={14} className="text-gray-500" />
          </div>
          <div className="space-y-2">
            {children.map(child => {
              const cs = statusConfig[child.status];
              return (
                <button
                  key={child.id}
                  onClick={() => onSelectAgent(child.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#0f1117] border border-gray-800 hover:border-gray-600 transition-all text-right"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{child.name}</p>
                    <p className="text-gray-500 text-xs truncate">{child.tasksCompleted} הושלמו · {child.lastActive}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${cs.color} ${cs.bg} flex-shrink-0`}>
                    <span className={`w-1 h-1 rounded-full ${cs.dot} ${child.status === 'active' ? 'animate-pulse' : ''}`} />
                    {cs.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
