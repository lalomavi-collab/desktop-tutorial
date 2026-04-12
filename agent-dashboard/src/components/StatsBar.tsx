import { Bot, CheckCircle2, Zap, TrendingUp, Clock, DollarSign } from 'lucide-react';
import type { Agent } from '../types';

interface StatsBarProps {
  agents: Agent[];
}

export function StatsBar({ agents }: StatsBarProps) {
  const activeCount = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksCompleted, 0);
  const runningTasks = agents.reduce((s, a) => s + a.tasksRunning, 0);
  const queuedTasks = agents.reduce((s, a) => s + (a.tasksQueue ?? 0), 0);
  const totalCost = agents.reduce((s, a) => s + (a.metrics?.costThisMonth ?? 0), 0);

  const avgSuccess = agents
    .filter(a => a.metrics)
    .reduce((s, a, _, arr) => s + (a.metrics!.successRate / arr.length), 0);

  const stats = [
    {
      label: 'סוכנים פעילים',
      value: `${activeCount}/${agents.length}`,
      sub: `${agents.length - activeCount} לא פעילים`,
      icon: Bot,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'משימות הושלמו',
      value: totalTasks.toLocaleString(),
      sub: `${runningTasks} רצות כעת`,
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'בתור להפעלה',
      value: queuedTasks,
      sub: 'ממתינות לעיבוד',
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'אחוז הצלחה כולל',
      value: `${avgSuccess.toFixed(1)}%`,
      sub: 'ממוצע כל הסוכנים',
      icon: TrendingUp,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'עלות החודש',
      value: `$${totalCost.toFixed(1)}`,
      sub: 'API + tokens',
      icon: DollarSign,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
    },
    {
      label: 'משימות רצות',
      value: runningTasks,
      sub: 'ב-real time',
      icon: Zap,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6 lg:grid-cols-6">
      {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={15} className={color} />
            </div>
            <p className={`font-bold text-lg leading-tight ${color}`}>{value}</p>
          </div>
          <p className="text-gray-400 text-xs text-right font-medium leading-tight">{label}</p>
          {sub && <p className="text-gray-600 text-[10px] text-right mt-0.5">{sub}</p>}
        </div>
      ))}
    </div>
  );
}
