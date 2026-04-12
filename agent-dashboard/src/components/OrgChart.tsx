import { Crown, Bot } from 'lucide-react';
import type { Agent } from '../types';

interface OrgChartProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

const statusDot: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  paused: 'bg-gray-500',
  error: 'bg-red-500',
};

const colorAccent: Record<string, { ring: string; bg: string; text: string }> = {
  gold:   { ring: 'ring-yellow-400/60',  bg: 'bg-yellow-500/15',  text: 'text-yellow-300' },
  purple: { ring: 'ring-purple-400/60',  bg: 'bg-purple-500/15',  text: 'text-purple-300' },
  blue:   { ring: 'ring-blue-400/60',    bg: 'bg-blue-500/15',    text: 'text-blue-300' },
  orange: { ring: 'ring-orange-400/60',  bg: 'bg-orange-500/15',  text: 'text-orange-300' },
  teal:   { ring: 'ring-teal-400/60',    bg: 'bg-teal-500/15',    text: 'text-teal-300' },
  green:  { ring: 'ring-green-400/60',   bg: 'bg-green-500/15',   text: 'text-green-300' },
  red:    { ring: 'ring-red-400/60',     bg: 'bg-red-500/15',     text: 'text-red-300' },
  cyan:   { ring: 'ring-cyan-400/60',    bg: 'bg-cyan-500/15',    text: 'text-cyan-300' },
  default:{ ring: 'ring-gray-600',       bg: 'bg-gray-700/40',    text: 'text-gray-300' },
};

function AgentNode({
  agent,
  selected,
  onClick,
  size = 'sm',
}: {
  agent: Agent;
  selected: boolean;
  onClick: () => void;
  size?: 'lg' | 'sm';
}) {
  const ac = colorAccent[agent.color ?? 'default'];
  const isLg = size === 'lg';

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 transition-transform hover:scale-105 focus:outline-none ${isLg ? 'w-32' : 'w-24'}`}
    >
      {/* Avatar */}
      <div
        className={`relative flex items-center justify-center rounded-2xl ${ac.bg} ring-2 transition-all
          ${selected ? `${ac.ring} shadow-lg` : 'ring-gray-700/60'}
          ${isLg ? 'w-16 h-16' : 'w-12 h-12'}`}
      >
        {agent.type === 'ceo' ? (
          <Crown size={isLg ? 24 : 18} className={ac.text} />
        ) : (
          <Bot size={isLg ? 22 : 16} className={ac.text} />
        )}
        {/* Status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#0f1117]
            ${statusDot[agent.status]}
            ${isLg ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}
            ${agent.status === 'active' ? 'animate-pulse' : ''}`}
        />
      </div>

      {/* Name & role */}
      <div className="text-center leading-tight">
        <p className={`font-medium text-white truncate max-w-full px-0.5 ${isLg ? 'text-xs' : 'text-[10px]'}`}>
          {agent.role ?? agent.name.split(' — ')[1] ?? agent.name}
        </p>
        <p className={`text-gray-500 truncate max-w-full ${isLg ? 'text-[10px]' : 'text-[9px]'}`}>
          {agent.name.split(' ')[0]}
        </p>
      </div>

      {/* Running tasks badge */}
      {agent.tasksRunning > 0 && (
        <span className="absolute -top-1 -left-1 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
          {agent.tasksRunning}
        </span>
      )}
    </button>
  );
}

export function OrgChart({ agents, selectedAgentId, onSelectAgent }: OrgChartProps) {
  const ceo = agents.find(a => a.type === 'ceo');
  const reports = agents.filter(a => a.parent === ceo?.id);

  if (!ceo) return null;

  return (
    <div className="bg-[#13151f] border border-gray-800 rounded-xl p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-5">
        <span className="text-gray-600 text-xs">לחץ על סוכן לפרטים</span>
        <h2 className="text-white font-semibold text-sm">מבנה ארגוני</h2>
      </div>

      <div className="flex flex-col items-center min-w-max mx-auto">
        {/* CEO */}
        <AgentNode
          agent={ceo}
          selected={selectedAgentId === ceo.id}
          onClick={() => onSelectAgent(ceo.id)}
          size="lg"
        />

        {/* Connector line down */}
        {reports.length > 0 && (
          <div className="w-px h-8 bg-gray-700 mt-1" />
        )}

        {/* Horizontal bar */}
        {reports.length > 0 && (
          <div className="flex flex-col items-center w-full">
            <div
              className="h-px bg-gray-700"
              style={{ width: `${Math.min(reports.length * 112, reports.length * 112)}px` }}
            />

            {/* Reports row */}
            <div className="flex items-start gap-2 mt-0">
              {reports.map((agent, i) => (
                <div key={agent.id} className="flex flex-col items-center">
                  {/* Tick up */}
                  <div className={`w-px bg-gray-700 ${i === Math.floor((reports.length - 1) / 2) ? 'h-0' : 'h-6'}`} />
                  <div className="w-px h-6 bg-gray-700" />
                  <AgentNode
                    agent={agent}
                    selected={selectedAgentId === agent.id}
                    onClick={() => onSelectAgent(agent.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
