import { Bot, CheckCircle2, Zap, TrendingUp } from 'lucide-react';
import type { Agent } from '../types';

interface StatsBarProps {
  agents: Agent[];
}

export function StatsBar({ agents }: StatsBarProps) {
  const activeCount = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksCompleted, 0);
  const runningTasks = agents.reduce((s, a) => s + a.tasksRunning, 0);

  const stats = [
    { label: 'סוכנים פעילים', value: `${activeCount}/${agents.length}`, icon: Bot, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'משימות הושלמו', value: totalTasks.toLocaleString(), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'משימות רצות', value: runningTasks, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'אחוז הצלחה', value: '97.3%', icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={color} />
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-xl leading-tight">{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
