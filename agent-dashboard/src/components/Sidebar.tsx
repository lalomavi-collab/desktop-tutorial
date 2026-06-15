import { Bot, LayoutDashboard, Share2, BarChart2, Settings, Zap, Briefcase } from 'lucide-react';
import type { Agent } from '../types';

interface SidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  activeView: 'dashboard' | 'social' | 'analytics' | 'settings' | 'worker';
  onSelectAgent: (id: string) => void;
  onViewChange: (view: 'dashboard' | 'social' | 'analytics' | 'settings' | 'worker') => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  paused: 'bg-gray-500',
  error: 'bg-red-500',
};

export function Sidebar({ agents, selectedAgentId, activeView, onSelectAgent, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard },
    { id: 'social', label: 'רשתות חברתיות', icon: Share2 },
    { id: 'worker', label: 'Worker — דרושים', icon: Briefcase },
    { id: 'analytics', label: 'אנליטיקס', icon: BarChart2 },
    { id: 'settings', label: 'הגדרות', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 flex-shrink-0 bg-[#13151f] border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">Agent Studio</h1>
            <p className="text-gray-500 text-xs">לוח בקרה</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 border-b border-gray-800">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
              activeView === id
                ? 'bg-purple-500/20 text-purple-300 font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-gray-600 text-xs font-medium uppercase tracking-wider px-3 mb-2">סוכנים</p>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 group ${
              selectedAgentId === agent.id
                ? 'bg-gray-700/60 text-white'
                : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center">
                <Bot size={14} className="text-gray-300" />
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#13151f] ${statusColors[agent.status]}`} />
            </div>
            <div className="flex-1 text-right min-w-0">
              <p className="truncate text-xs font-medium">{agent.name}</p>
              <p className="text-xs text-gray-600 truncate">{agent.lastActive}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            M
          </div>
          <div className="text-right flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">My Workspace</p>
            <p className="text-xs text-gray-600">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
