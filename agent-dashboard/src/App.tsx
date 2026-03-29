import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SocialMediaAgent } from './components/SocialMediaAgent';
import { mockAgents, mockActivity } from './data/mockData';

type View = 'dashboard' | 'social' | 'analytics' | 'settings';

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedAgent = mockAgents.find(a => a.id === selectedAgentId) ?? null;
  const socialAgent = mockAgents.find(a => a.type === 'social-media')!;

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    const agent = mockAgents.find(a => a.id === id);
    if (agent?.type === 'social-media') {
      setActiveView('social');
    }
  };

  const handleViewChange = (view: View) => {
    setActiveView(view);
    if (view === 'social') {
      setSelectedAgentId(socialAgent.id);
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
        {activeView === 'dashboard' && (
          <DashboardView
            agents={mockAgents}
            activities={mockActivity}
            onSelectAgent={handleSelectAgent}
          />
        )}

        {activeView === 'social' && (
          <div>
            <div className="mb-6 text-right">
              <h1 className="text-white font-bold text-2xl">רשתות חברתיות</h1>
              <p className="text-gray-500 text-sm mt-1">ניהול פרסומים, חיבורים ואנליטיקס</p>
            </div>
            <SocialMediaAgent agent={selectedAgent?.type === 'social-media' ? selectedAgent : socialAgent} />
          </div>
        )}

        {activeView === 'analytics' && (
          <div className="text-right">
            <div className="mb-6">
              <h1 className="text-white font-bold text-2xl">אנליטיקס</h1>
              <p className="text-gray-500 text-sm mt-1">נתונים וביצועים מצטברים</p>
            </div>
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-500">דוחות מפורטים יהיו זמינים בקרוב</p>
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="text-right">
            <div className="mb-6">
              <h1 className="text-white font-bold text-2xl">הגדרות</h1>
              <p className="text-gray-500 text-sm mt-1">הגדרות סביבת העבודה והסוכנים</p>
            </div>
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-500">הגדרות יהיו זמינות בקרוב</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
