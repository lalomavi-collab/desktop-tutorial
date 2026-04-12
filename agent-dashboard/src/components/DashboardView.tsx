import { AgentCard } from './AgentCard';
import { StatsBar } from './StatsBar';
import { ActivityFeed } from './ActivityFeed';
import { OrgChart } from './OrgChart';
import type { Agent, ActivityItem } from '../types';

interface DashboardViewProps {
  agents: Agent[];
  activities: ActivityItem[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

export function DashboardView({ agents, activities, selectedAgentId, onSelectAgent }: DashboardViewProps) {
  return (
    <div>
      <div className="mb-6 text-right">
        <h1 className="text-white font-bold text-2xl">לוח בקרה</h1>
        <p className="text-gray-500 text-sm mt-1">מרכז ניהול הסוכנים שלך</p>
      </div>

      <StatsBar agents={agents} />

      {/* Org chart */}
      <div className="mb-6">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
          מבנה ארגוני
        </h2>
        <OrgChart
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Agents grid */}
        <div className="col-span-2">
          <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
            הסוכנים שלי ({agents.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => onSelectAgent(agent.id)}
              />
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
            פעילות
          </h2>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
