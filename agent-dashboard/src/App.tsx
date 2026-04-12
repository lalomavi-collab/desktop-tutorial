import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SocialMediaManager } from './components/SocialMediaManager';
import { GenericAgentDetail } from './components/GenericAgentDetail';
import { mockAgents, mockActivity } from './data/mockData';

type View = 'dashboard' | 'agent' | 'analytics' | 'settings';

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const socialManager = mockAgents.find(a => a.type === 'social-manager')!;
  const selectedAgent = selectedAgentId ? mockAgents.find(a => a.id === selectedAgentId) : null;

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    setActiveView('agent');
  };

  const handleViewChange = (view: View) => {
    setActiveView(view);
    if (view !== 'agent') {
      setSelectedAgentId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0f1117]" dir="rtl">
      <Sidebar
        agents={mockAgents}
        selectedAgentId={selectedAgentId}
        activeView={activeView}
        onSelectAgent={handleSelectAgent}
        onViewChange={handleViewChange}
      />

      <main className="flex-1 overflow-auto p-6">
        {/* ── Dashboard overview ─────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <DashboardView
            agents={mockAgents}
            activities={mockActivity}
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
          />
        )}

        {/* ── Agent detail ───────────────────────────────────────────── */}
        {activeView === 'agent' && selectedAgent && (
          <div>
            {selectedAgent.type === 'social-manager' ? (
              <>
                <div className="mb-5 text-right">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span>אורי מנכ"ל</span>
                      <span>›</span>
                      <span className="text-purple-400">עידית מנהלת השיווק</span>
                    </div>
                    <div>
                      <h1 className="text-white font-bold text-2xl">ניהול רשתות חברתיות</h1>
                      <p className="text-gray-500 text-sm mt-0.5">
                        עידית ← Twitter · Instagram · LinkedIn · Facebook · TikTok · Telegram
                      </p>
                    </div>
                  </div>
                </div>
                <SocialMediaManager agent={socialManager} />
              </>
            ) : (
              <GenericAgentDetail
                agent={selectedAgent}
                allAgents={mockAgents}
                onSelectAgent={handleSelectAgent}
              />
            )}
          </div>
        )}

        {/* ── Analytics ──────────────────────────────────────────────── */}
        {activeView === 'analytics' && (
          <div className="text-right">
            <div className="mb-6">
              <h1 className="text-white font-bold text-2xl">אנליטיקס</h1>
              <p className="text-gray-500 text-sm mt-1">נתונים וביצועים מצטברים</p>
            </div>

            {/* Per-agent metrics table */}
            <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-white font-semibold text-sm">ביצועי סוכנים</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
                      <th className="text-right px-4 py-3 font-medium">סוכן</th>
                      <th className="text-center px-4 py-3 font-medium">סטטוס</th>
                      <th className="text-center px-4 py-3 font-medium">הצלחה</th>
                      <th className="text-center px-4 py-3 font-medium">זמינות</th>
                      <th className="text-center px-4 py-3 font-medium">השבוע</th>
                      <th className="text-center px-4 py-3 font-medium">סה"כ</th>
                      <th className="text-center px-4 py-3 font-medium">עלות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAgents.map(agent => {
                      const statusColors: Record<string, string> = {
                        active: 'text-green-400',
                        idle: 'text-yellow-400',
                        paused: 'text-gray-500',
                        error: 'text-red-400',
                      };
                      const statusLabels: Record<string, string> = {
                        active: 'פעיל',
                        idle: 'ממתין',
                        paused: 'מושהה',
                        error: 'שגיאה',
                      };
                      return (
                        <tr
                          key={agent.id}
                          onClick={() => handleSelectAgent(agent.id)}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="text-right">
                              <p className="text-white font-medium text-xs">{agent.name}</p>
                              <p className="text-gray-500 text-xs">{agent.role}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium ${statusColors[agent.status]}`}>
                              {statusLabels[agent.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-green-400 text-xs font-medium">
                              {agent.metrics?.successRate ?? '—'}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-blue-400 text-xs">
                              {agent.metrics?.uptime ?? '—'}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-gray-300 text-xs">
                              {agent.metrics?.tasksThisWeek ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-gray-300 text-xs">
                              {agent.tasksCompleted.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-teal-400 text-xs">
                              ${agent.metrics?.costThisMonth?.toFixed(1) ?? '0.0'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Settings ───────────────────────────────────────────────── */}
        {activeView === 'settings' && (
          <div className="text-right">
            <div className="mb-6">
              <h1 className="text-white font-bold text-2xl">הגדרות</h1>
              <p className="text-gray-500 text-sm mt-1">הגדרות סביבת העבודה והסוכנים</p>
            </div>
            <div className="space-y-4">
              {/* Workspace */}
              <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">סביבת עבודה</h3>
                <div className="space-y-3">
                  {[
                    { label: 'שם הסביבה', value: 'My Workspace' },
                    { label: 'תוכנית', value: 'Pro' },
                    { label: 'מגבלת עלות חודשית', value: '$50.00' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-400 text-xs bg-gray-800/50 px-3 py-1 rounded">{value}</span>
                      <span className="text-gray-500 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent defaults */}
              <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">ברירות מחדל לסוכנים</h3>
                <div className="space-y-3">
                  {[
                    { label: 'מודל ברירת מחדל', value: 'claude-sonnet-4-6' },
                    { label: 'שפה ראשית', value: 'עברית' },
                    { label: 'שמירת היסטוריה', value: '30 יום' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-400 text-xs bg-gray-800/50 px-3 py-1 rounded">{value}</span>
                      <span className="text-gray-500 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4">אינטגרציות</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Zapier', connected: true },
                    { label: 'Slack', connected: true },
                    { label: 'GitHub Actions', connected: true },
                    { label: 'Google Analytics', connected: false },
                  ].map(({ label, connected }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${connected ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-gray-700/30'}`}>
                        {connected ? 'מחובר' : 'לא מחובר'}
                      </span>
                      <span className="text-gray-400 text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
