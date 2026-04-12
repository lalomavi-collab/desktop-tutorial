import { Bot, Crown, Play, Pause, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import type { Agent } from '../types';

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
}

const statusConfig = {
  active: { label: 'פעיל',   color: 'text-green-400',  bg: 'bg-green-500/10',  dot: 'bg-green-500',  icon: Play },
  idle:   { label: 'ממתין',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', icon: Clock },
  paused: { label: 'מושהה', color: 'text-gray-400',   bg: 'bg-gray-500/10',   dot: 'bg-gray-500',   icon: Pause },
  error:  { label: 'שגיאה', color: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-500',    icon: AlertCircle },
};

const colorAccent: Record<string, { bg: string; text: string; ring: string }> = {
  gold:    { bg: 'bg-yellow-500/15', text: 'text-yellow-300', ring: 'group-hover:ring-yellow-500/40' },
  purple:  { bg: 'bg-purple-500/15', text: 'text-purple-300', ring: 'group-hover:ring-purple-500/40' },
  blue:    { bg: 'bg-blue-500/15',   text: 'text-blue-300',   ring: 'group-hover:ring-blue-500/40' },
  orange:  { bg: 'bg-orange-500/15', text: 'text-orange-300', ring: 'group-hover:ring-orange-500/40' },
  teal:    { bg: 'bg-teal-500/15',   text: 'text-teal-300',   ring: 'group-hover:ring-teal-500/40' },
  green:   { bg: 'bg-green-500/15',  text: 'text-green-300',  ring: 'group-hover:ring-green-500/40' },
  red:     { bg: 'bg-red-500/15',    text: 'text-red-300',    ring: 'group-hover:ring-red-500/40' },
  cyan:    { bg: 'bg-cyan-500/15',   text: 'text-cyan-300',   ring: 'group-hover:ring-cyan-500/40' },
  default: { bg: 'bg-gray-700/30',   text: 'text-gray-300',   ring: 'group-hover:ring-gray-500/40' },
};

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const status = statusConfig[agent.status];
  const ac = colorAccent[agent.color ?? 'default'];

  return (
    <button
      onClick={onClick}
      className="bg-[#13151f] border border-gray-800 rounded-xl p-5 text-right w-full transition-all hover:border-gray-600 hover:bg-[#161925] group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
          {status.label}
        </div>
        <div className={`w-10 h-10 rounded-xl ${ac.bg} ring-2 ring-transparent ${ac.ring} flex items-center justify-center transition-all`}>
          {agent.type === 'ceo' ? (
            <Crown size={18} className={ac.text} />
          ) : (
            <Bot size={18} className={ac.text} />
          )}
        </div>
      </div>

      <h3 className="text-white font-semibold text-sm mb-0.5">{agent.name}</h3>
      {agent.role && <p className={`text-xs font-medium mb-1 ${ac.text}`}>{agent.role}</p>}
      <p className="text-gray-500 text-xs mb-4 leading-relaxed line-clamp-2">{agent.description}</p>

      {/* Skills preview */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="flex gap-1 flex-wrap justify-end mb-4">
          {agent.skills.slice(0, 2).map(skill => (
            <span key={skill} className={`text-[10px] px-1.5 py-0.5 rounded ${ac.bg} ${ac.text}`}>
              {skill}
            </span>
          ))}
          {agent.skills.length > 2 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-500">
              +{agent.skills.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle2 size={12} />
              <span className="text-xs font-semibold">{agent.tasksCompleted.toLocaleString()}</span>
            </div>
            <p className="text-gray-600 text-[10px]">הושלמו</p>
          </div>
          {agent.tasksRunning > 0 && (
            <div className="text-center">
              <div className="flex items-center gap-1 text-blue-400">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs font-semibold">{agent.tasksRunning}</span>
              </div>
              <p className="text-gray-600 text-[10px]">רצות</p>
            </div>
          )}
          {(agent.tasksQueue ?? 0) > 0 && (
            <div className="text-center">
              <div className="flex items-center gap-1 text-yellow-400">
                <Clock size={12} />
                <span className="text-xs font-semibold">{agent.tasksQueue}</span>
              </div>
              <p className="text-gray-600 text-[10px]">בתור</p>
            </div>
          )}
        </div>
        <p className="text-gray-600 text-[10px]">{agent.lastActive}</p>
      </div>

      {/* Success rate bar */}
      {agent.metrics && (
        <div className="mt-3 pt-3 border-t border-gray-800/60">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-green-400">{agent.metrics.successRate}%</span>
            <span className="text-gray-600">הצלחה</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500/70 transition-all"
              style={{ width: `${agent.metrics.successRate}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
