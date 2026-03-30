import { useState } from 'react';
import {
  Zap, Send, Calendar, Users,
  Plus, Eye, Heart, Repeat2, MessageCircle,
  ChevronDown, ChevronUp, Crown, UserCircle2
} from 'lucide-react';
import type { Agent, Platform, PlatformAgent } from '../types';
import { PlatformAgentCard, platformMeta } from './PlatformAgentCard';
import { PostComposer } from './PostComposer';
import { PostList } from './PostList';
import { ScheduleConfig } from './ScheduleConfig';
import { ContentCalendar } from './ContentCalendar';
import type { MotzeiShabbatPost } from './ContentCalendar';
import type { ScheduleSettings } from './ScheduleConfig';
import { sendToZapier } from '../lib/zapier';
import { mockPosts } from '../data/mockData';
import { PlatformAgentDetail, defaultConfig } from './PlatformAgentDetail';
import { PostApprovalQueue, SEED_POSTS } from './PostApprovalQueue';
import type { PlatformAgentConfig, QueuedPost } from '../types';

interface SocialMediaManagerProps {
  agent: Agent;
}

export function SocialMediaManager({ agent }: SocialMediaManagerProps) {
  const [platformAgents, setPlatformAgents] = useState<PlatformAgent[]>(
    agent.platformAgents ?? []
  );
  const [syncing, setSyncing] = useState<Platform | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'approval' | 'calendar' | 'posts' | 'analytics'>('agents');
  const [orgExpanded, setOrgExpanded] = useState(true);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings | null>(null);
  const [calendarPosts, setCalendarPosts] = useState<MotzeiShabbatPost[]>([]);
  const [detailPlatform, setDetailPlatform] = useState<Platform | null>(null);
  const [agentConfigs, setAgentConfigs] = useState<Partial<Record<Platform, PlatformAgentConfig>>>({});
  const [queuedPosts, setQueuedPosts] = useState<QueuedPost[]>(SEED_POSTS);

  const connectedAgents = platformAgents.filter(a => a.connection.connected);
  const totalFollowers = connectedAgents.reduce((s, a) => s + (a.connection.followers ?? 0), 0);
  const totalPostsToday = connectedAgents.reduce((s, a) => s + a.postsToday, 0);
  const totalScheduled = connectedAgents.reduce((s, a) => s + a.scheduledPosts, 0);

  const handleConnect = (platform: Platform) => {
    setConnecting(platform);
    setTimeout(() => {
      setPlatformAgents(prev => prev.map(a =>
        a.platform === platform
          ? {
              ...a,
              status: 'active',
              connection: { ...a.connection, connected: true, username: `@my_brand`, followers: 1100, lastSync: 'עכשיו' },
            }
          : a
      ));
      setConnecting(null);
    }, 2000);
  };

  const handleDisconnect = (platform: Platform) => {
    setPlatformAgents(prev => prev.map(a =>
      a.platform === platform
        ? { ...a, status: 'idle', connection: { platform, connected: false }, postsToday: 0, scheduledPosts: 0 }
        : a
    ));
  };

  const handleSync = (platform: Platform) => {
    setSyncing(platform);
    setTimeout(() => {
      setPlatformAgents(prev => prev.map(a =>
        a.platform === platform
          ? { ...a, connection: { ...a.connection, lastSync: 'עכשיו' } }
          : a
      ));
      setSyncing(null);
    }, 1500);
  };

  const handleOpenDetail = (platform: Platform) => {
    setDetailPlatform(platform);
  };

  const handleSaveConfig = (platform: Platform, config: PlatformAgentConfig) => {
    setAgentConfigs(prev => ({ ...prev, [platform]: config }));
  };

  const handleSendNow = async (post: MotzeiShabbatPost) => {
    const result = await sendToZapier({
      content: post.content,
      platforms: post.platforms,
      schedule_mode: 'now',
      agent: 'עידית — מנהלת השיווק',
      timestamp: new Date().toISOString(),
    });
    if (result.ok) {
      setCalendarPosts(prev =>
        prev.map(p => p.id === post.id ? { ...p, status: 'sent' } : p)
      );
    } else {
      setCalendarPosts(prev =>
        prev.map(p => p.id === post.id ? { ...p, status: 'failed' } : p)
      );
    }
  };

  const pendingCount = queuedPosts.filter(p => p.status === 'pending').length;

  const tabs = [
    { id: 'agents',   label: 'סוכנים' },
    { id: 'approval', label: pendingCount > 0 ? `אישורים (${pendingCount})` : 'אישורים' },
    { id: 'calendar', label: 'מוצ"ש' },
    { id: 'posts',    label: 'פוסטים' },
    { id: 'analytics',label: 'ביצועים' },
  ] as const;

  const connections = platformAgents.map(a => a.connection);

  return (
    <div className="space-y-5">

      {/* Org chart card */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setOrgExpanded(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-500">
            {orgExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="text-xs">מבנה ארגוני</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">מבנה הצוות</span>
          </div>
        </button>

        {orgExpanded && (
          <div className="px-5 pb-5 border-t border-gray-800/60">
            {/* CEO */}
            <div className="flex flex-col items-center mt-4">
              <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                <div className="text-right">
                  <p className="text-white font-bold text-sm">אורי</p>
                  <p className="text-yellow-400 text-xs">מנכ"ל</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Crown size={18} className="text-yellow-400" />
                </div>
              </div>

              {/* Connector */}
              <div className="w-px h-5 bg-gray-700" />

              {/* Marketing Manager */}
              <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
                <div className="text-right">
                  <p className="text-white font-bold text-sm">עידית</p>
                  <p className="text-purple-400 text-xs">מנהלת שיווק</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-400 text-xs">פעילה</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <UserCircle2 size={20} className="text-purple-400" />
                </div>
              </div>

              {/* Connector to sub-agents */}
              <div className="w-px h-5 bg-gray-700" />

              {/* Sub-agents row */}
              <div className="flex items-start gap-2 justify-center flex-wrap">
                {platformAgents.map((pa) => {
                  const meta = platformMeta[pa.platform];
                  return (
                    <div key={pa.platform} className="flex flex-col items-center">
                      <div className="w-px h-3 bg-gray-700" />
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                        pa.connection.connected
                          ? `${meta.bg} ${meta.textColor} ${meta.border}`
                          : 'bg-gray-800/40 border-gray-700/40 text-gray-600'
                      }`}>
                        {meta.icon}
                        {meta.label.split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manager header */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">פעילה</span>
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
              <Zap size={11} className="text-orange-400" />
              <span className="text-orange-400 text-xs font-medium">Zapier</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <div>
                <h2 className="text-white font-bold text-lg">עידית — מנהלת השיווק</h2>
                <p className="text-gray-500 text-sm">מדווחת ל: אורי מנכ"ל</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <UserCircle2 size={22} className="text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-800">
          <div className="text-center">
            <p className="text-white font-bold text-lg">{connectedAgents.length}/{platformAgents.length}</p>
            <p className="text-gray-600 text-xs">סוכנים פעילים</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{(totalFollowers / 1000).toFixed(1)}K</p>
            <p className="text-gray-600 text-xs">עוקבים כוללים</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{totalPostsToday}</p>
            <p className="text-gray-600 text-xs">פוסטים היום</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{totalScheduled}</p>
            <p className="text-gray-600 text-xs">מתוזמנים</p>
          </div>
        </div>

        {/* Broadcast button */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={() => setShowBroadcast(true)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={16} />
            פרסם לכל הרשתות (Broadcast)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13151f] border border-gray-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Platform agents grid */}
      {activeTab === 'agents' && (
        <div>
          <p className="text-gray-600 text-xs text-right mb-3 uppercase tracking-wider">
            סוכני פלטפורמות — מנוהלים ע"י עידית
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {platformAgents.map(pa => (
              <PlatformAgentCard
                key={pa.platform}
                agent={pa}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                onOpenDetail={handleOpenDetail}
                syncing={syncing}
                connecting={connecting}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <PostApprovalQueue
          posts={queuedPosts}
          onUpdate={setQueuedPosts}
          connectedPlatforms={connectedAgents.map(a => a.platform)}
        />
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <ScheduleConfig
            platforms={connectedAgents.map(a => a.platform)}
            onSave={s => setScheduleSettings(s)}
          />
          {scheduleSettings?.enabled !== false && (
            <ContentCalendar
              posts={calendarPosts}
              onUpdate={setCalendarPosts}
              onSendNow={handleSendNow}
            />
          )}
        </div>
      )}

      {activeTab === 'posts' && (
        <PostList posts={mockPosts} onNewPost={() => setShowBroadcast(true)} />
      )}

      {activeTab === 'analytics' && (
        <ManagerAnalytics agents={connectedAgents} />
      )}

      {/* Broadcast composer */}
      {showBroadcast && (
        <PostComposer
          connections={connections}
          onClose={() => setShowBroadcast(false)}
        />
      )}

      {/* Platform agent detail panel */}
      {detailPlatform && (() => {
        const pa = platformAgents.find(a => a.platform === detailPlatform);
        if (!pa) return null;
        return (
          <PlatformAgentDetail
            agent={pa}
            config={agentConfigs[detailPlatform] ?? defaultConfig(detailPlatform)}
            onClose={() => setDetailPlatform(null)}
            onSaveConfig={handleSaveConfig}
          />
        );
      })()}
    </div>
  );
}

function ManagerAnalytics({ agents }: { agents: PlatformAgent[] }) {
  const metrics = [
    { label: 'רשמות כוללות', value: '48.2K', change: '+12%', icon: Eye, color: 'text-purple-400' },
    { label: 'לייקים', value: '3.1K', change: '+8.7%', icon: Heart, color: 'text-pink-400' },
    { label: 'שיתופים', value: '842', change: '+23%', icon: Repeat2, color: 'text-sky-400' },
    { label: 'תגובות', value: '291', change: '+5%', icon: MessageCircle, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 text-right">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-xs bg-green-500/10 px-2 py-0.5 rounded-full">{change}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-white font-bold text-2xl">{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-agent breakdown */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 text-right">ביצועים לפי סוכן</h3>
        {agents.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">אין סוכנים מחוברים</p>
        ) : (
          <div className="space-y-3">
            {agents.map(a => {
              const meta = platformMeta[a.platform];
              const maxPosts = Math.max(...agents.map(x => x.postsTotal), 1);
              return (
                <div key={a.platform} className="flex items-center gap-3">
                  <div className="w-24 text-right flex items-center gap-1 justify-end">
                    <span className="text-gray-400 text-xs">{a.postsTotal} פוסטים</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${meta.bg}`}
                        style={{ width: `${(a.postsTotal / maxPosts) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 w-28 justify-end ${meta.textColor}`}>
                    <span className="text-xs font-medium">{meta.label}</span>
                    {meta.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Posts summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'סה"כ פוסטים היום', value: agents.reduce((s, a) => s + a.postsToday, 0), icon: Send, color: 'text-purple-400' },
          { label: 'מתוזמנים', value: agents.reduce((s, a) => s + a.scheduledPosts, 0), icon: Calendar, color: 'text-orange-400' },
          { label: 'עוקבים', value: `${(agents.reduce((s, a) => s + (a.connection.followers ?? 0), 0) / 1000).toFixed(1)}K`, icon: Users, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 text-right">
            <Icon size={16} className={`${color} mb-2`} />
            <p className="text-white font-bold text-xl">{value}</p>
            <p className="text-gray-600 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
