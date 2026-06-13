import { AgentCard } from './AgentCard';
import { StatsBar } from './StatsBar';
import { ActivityFeed } from './ActivityFeed';
import { OrgChart } from './OrgChart';
import { LiveActivityPanel } from './LiveActivityPanel';
import type { Agent, ActivityItem } from '../types';

interface DashboardViewProps {
  agents: Agent[];
  activities: ActivityItem[];
  onSelectAgent: (id: string) => void;
}

export function DashboardView({ agents, activities, onSelectAgent }: DashboardViewProps) {
  const displayAgents = agents.filter(a => a.type !== 'ceo');

  return (
    <div>
      <div className="mb-6 text-right">
        <h1 className="text-white font-bold text-2xl">לוח בקרה</h1>
        <p className="text-gray-500 text-sm mt-1">מרכז ניהול הסוכנים שלך</p>
      </div>

      <StatsBar agents={agents} />

      <div className="grid grid-cols-3 gap-5 mt-5">
        {/* Left column: org + agents */}
        <div className="col-span-2 space-y-5">
          {/* Org chart */}
          <OrgChart
            agents={agents}
            selectedAgentId={null}
            onSelectAgent={onSelectAgent}
          />

          {/* Agent cards */}
          <div>
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
              סוכנים ({displayAgents.length})
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {displayAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => onSelectAgent(agent.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: live activity + feed */}
        <div className="space-y-4">
          <LiveActivityPanel onGoToWorker={() => onSelectAgent('agent-worker')} />
          <div>
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
              פעילות אחרונה
            </h2>
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
