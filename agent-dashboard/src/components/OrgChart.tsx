import { Bot, ChevronRight } from 'lucide-react';
import type { Agent } from '../types';

interface OrgChartProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  paused: 'bg-gray-500',
  error: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  idle: 'ממתין',
  paused: 'מושהה',
  error: 'שגיאה',
};

function AgentNode({
  agent,
  selected,
  onClick,
  isRoot,
}: {
  agent: Agent;
  selected: boolean;
  onClick: () => void;
  isRoot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 group transition-all ${isRoot ? 'scale-100' : ''}`}
    >
      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white transition-all
        ${isRoot
          ? 'bg-gradient-to-br from-purple-600 to-blue-700 shadow-lg shadow-purple-900/40'
          : 'bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600'}
        ${selected ? 'ring-2 ring-purple-400 scale-110' : 'group-hover:scale-105'}
      `}>
        {agent.avatar ?? <Bot size={22} />}
        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0f1117] ${statusColors[agent.status]}`} />
      </div>
      <div className="text-center">
        <p className={`text-xs font-semibold leading-tight ${selected ? 'text-purple-300' : 'text-gray-300 group-hover:text-white'}`}>
          {agent.avatar === 'א' || agent.type === 'ceo' ? 'אורי' : agent.name.split(' — ')[0].split(' ')[0]}
        </p>
        <p className="text-gray-600 text-xs">{agent.role ?? agent.type}</p>
      </div>
    </button>
  );
}

export function OrgChart({ agents, selectedAgentId, onSelectAgent }: OrgChartProps) {
  const ceo = agents.find(a => a.type === 'ceo');
  const directReports = agents.filter(a => a.reportsTo === 'agent-ceo');
  const getSubordinates = (id: string) => agents.filter(a => a.reportsTo === id);

  if (!ceo) return null;

  return (
    <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
      <h2 className="text-white font-semibold text-sm mb-5 flex items-center justify-end gap-2">
        <span>מבנה ארגוני</span>
        <ChevronRight size={14} className="text-gray-500" />
      </h2>

      <div className="flex flex-col items-center gap-0">
        {/* CEO */}
        <AgentNode
          agent={ceo}
          selected={selectedAgentId === ceo.id}
          onClick={() => onSelectAgent(ceo.id)}
          isRoot
        />

        {/* Connector line down */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Horizontal line */}
        <div className="relative flex items-start justify-center w-full">
          {/* top bar */}
          <div
            className="absolute top-0 bg-gray-700 h-px"
            style={{
              left: `${100 / (directReports.length * 2)}%`,
              right: `${100 / (directReports.length * 2)}%`,
            }}
          />

          {/* Direct reports */}
          <div className="flex justify-around w-full pt-0">
            {directReports.map((agent) => {
              const subs = getSubordinates(agent.id);
              return (
                <div key={agent.id} className="flex flex-col items-center gap-0">
                  {/* vertical from top bar */}
                  <div className="w-px h-5 bg-gray-700" />
                  <AgentNode
                    agent={agent}
                    selected={selectedAgentId === agent.id}
                    onClick={() => onSelectAgent(agent.id)}
                  />

                  {subs.length > 0 && (
                    <>
                      <div className="w-px h-4 bg-gray-700" />
                      <div className="relative flex items-start justify-center w-full">
                        <div
                          className="absolute top-0 bg-gray-700 h-px"
                          style={{
                            left: `${100 / (subs.length * 2)}%`,
                            right: `${100 / (subs.length * 2)}%`,
                          }}
                        />
                        <div className="flex justify-around w-full pt-0 gap-3">
                          {subs.map((sub) => (
                            <div key={sub.id} className="flex flex-col items-center">
                              <div className="w-px h-4 bg-gray-700" />
                              <AgentNode
                                agent={sub}
                                selected={selectedAgentId === sub.id}
                                onClick={() => onSelectAgent(sub.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-gray-800 flex justify-end gap-4 flex-wrap">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColors[key]}`} />
            <span className="text-gray-600 text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
