import { Bot, Play, Pause, AlertCircle, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import type { Agent } from '../types';

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
}

const statusConfig = {
  active: { label: 'פעיל', color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-500', icon: Play },
  idle: { label: 'ממתין', color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', icon: Clock },
  paused: { label: 'מושהה', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-500', icon: Pause },
  error: { label: 'שגיאה', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500', icon: AlertCircle },
};

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const status = statusConfig[agent.status];

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-blue-500/30 transition-all">
          <Bot size={18} className="text-purple-400" />
        </div>
      </div>

      <h3 className="text-white font-semibold text-sm mb-1">{agent.name}</h3>
      <p className="text-gray-500 text-xs mb-4 leading-relaxed">{agent.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle2 size={12} />
              <span className="text-xs font-semibold">{agent.tasksCompleted}</span>
            </div>
            <p className="text-gray-600 text-xs">הושלמו</p>
          </div>
          {agent.tasksRunning > 0 && (
            <div className="text-center">
              <div className="flex items-center gap-1 text-blue-400">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs font-semibold">{agent.tasksRunning}</span>
              </div>
              <p className="text-gray-600 text-xs">רצות</p>
            </div>
          )}
        </div>
        <p className="text-gray-600 text-xs">{agent.lastActive}</p>
      </div>
    </button>
  );
}
