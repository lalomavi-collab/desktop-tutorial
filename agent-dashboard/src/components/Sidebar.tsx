import { Crown, Bot, LayoutDashboard, BarChart2, Settings, Zap } from 'lucide-react';
import type { Agent } from '../types';

type View = 'dashboard' | 'agent' | 'analytics' | 'settings';

interface SidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  activeView: View;
  onSelectAgent: (id: string) => void;
  onViewChange: (view: View) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  paused: 'bg-gray-500',
  error: 'bg-red-500',
};

const colorAccentText: Record<string, string> = {
  gold:    'text-yellow-300',
  purple:  'text-purple-300',
  blue:    'text-blue-300',
  orange:  'text-orange-300',
  teal:    'text-teal-300',
  green:   'text-green-300',
  red:     'text-red-300',
  cyan:    'text-cyan-300',
  default: 'text-gray-300',
};

export function Sidebar({ agents, selectedAgentId, activeView, onSelectAgent, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'dashboard' as View, label: 'דשבורד', icon: LayoutDashboard },
    { id: 'analytics' as View, label: 'אנליטיקס', icon: BarChart2 },
    { id: 'settings' as View, label: 'הגדרות', icon: Settings },
  ];

  const ceo = agents.find(a => a.type === 'ceo');
  const reports = agents.filter(a => a.parent === ceo?.id);
  const standalone = agents.filter(a => !a.parent && a.type !== 'ceo');

  const totalRunning = agents.reduce((s, a) => s + a.tasksRunning, 0);

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

        {/* Live indicator */}
        {totalRunning > 0 && (
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <span className="text-gray-500 text-[10px]">{totalRunning} משימות רצות</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-3 border-b border-gray-800">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
              activeView === id && id !== 'agent'
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

        {/* CEO first */}
        {ceo && (
          <AgentButton
            agent={ceo}
            selected={selectedAgentId === ceo.id}
            onSelect={onSelectAgent}
            statusColors={statusColors}
            colorAccentText={colorAccentText}
          />
        )}

        {/* Direct reports */}
        {reports.length > 0 && (
          <>
            <div className="px-3 my-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-700 text-[9px] font-medium uppercase">דיווח ישיר</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
            </div>
            {reports.map(agent => (
              <AgentButton
                key={agent.id}
                agent={agent}
                selected={selectedAgentId === agent.id}
                onSelect={onSelectAgent}
                statusColors={statusColors}
                colorAccentText={colorAccentText}
                indent
              />
            ))}
          </>
        )}

        {/* Standalone agents */}
        {standalone.length > 0 && (
          <>
            <div className="px-3 my-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-700 text-[9px] font-medium uppercase">עצמאיים</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
            </div>
            {standalone.map(agent => (
              <AgentButton
                key={agent.id}
                agent={agent}
                selected={selectedAgentId === agent.id}
                onSelect={onSelectAgent}
                statusColors={statusColors}
                colorAccentText={colorAccentText}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            M
          </div>
          <div className="text-right flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">My Workspace</p>
            <p className="text-xs text-gray-600">Pro Plan · {agents.length} סוכנים</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AgentButton({
  agent,
  selected,
  onSelect,
  statusColors,
  colorAccentText,
  indent = false,
}: {
  agent: Agent;
  selected: boolean;
  onSelect: (id: string) => void;
  statusColors: Record<string, string>;
  colorAccentText: Record<string, string>;
  indent?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(agent.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 group ${
        selected
          ? 'bg-gray-700/60 text-white'
          : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
      } ${indent ? 'pl-5' : ''}`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gray-700/60 flex items-center justify-center">
          {agent.type === 'ceo' ? (
            <Crown size={13} className={colorAccentText[agent.color ?? 'default']} />
          ) : (
            <Bot size={13} className={colorAccentText[agent.color ?? 'default']} />
          )}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#13151f] ${statusColors[agent.status]} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
      </div>
      <div className="flex-1 text-right min-w-0">
        <p className="truncate text-xs font-medium">{agent.role ?? agent.name}</p>
        <p className="text-xs text-gray-600 truncate">{agent.lastActive}</p>
      </div>
      {agent.tasksRunning > 0 && (
        <span className="flex-shrink-0 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {agent.tasksRunning}
        </span>
      )}
    </button>
  );
}
