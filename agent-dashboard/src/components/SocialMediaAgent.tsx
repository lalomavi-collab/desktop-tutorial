import { useState } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw, Plus, Users,
  TrendingUp, Eye, MessageCircle, Repeat2, Heart,
  Link, Unlink
} from 'lucide-react';
import type { Agent, Platform, PlatformConnection } from '../types';
import { TwitterIcon, InstagramIcon, LinkedinIcon, FacebookIcon, TikTokIcon } from './SocialIcons';
import { PostComposer } from './PostComposer';
import { PostList } from './PostList';
import { mockPosts } from '../data/mockData';

interface SocialMediaAgentProps {
  agent: Agent;
}

const platformConfig: Record<Platform, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  description: string;
}> = {
  twitter: {
    label: 'Twitter / X',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    icon: <TwitterIcon size={20} />,
    description: 'ציוצים, תגובות, ריטוויטים',
  },
  instagram: {
    label: 'Instagram',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    icon: <InstagramIcon size={20} />,
    description: 'פוסטים, סטוריז, ריילז',
  },
  linkedin: {
    label: 'LinkedIn',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: <LinkedinIcon size={20} />,
    description: 'פוסטים מקצועיים, מאמרים',
  },
  facebook: {
    label: 'Facebook',
    color: 'text-blue-500',
    bg: 'bg-blue-600/10',
    border: 'border-blue-600/30',
    icon: <FacebookIcon size={20} />,
    description: 'פוסטים, סיפורים, אירועים',
  },
  tiktok: {
    label: 'TikTok',
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
    icon: <TikTokIcon size={20} />,
    description: 'וידאו קצר, דואטים',
  },
};

function formatFollowers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

interface ConnectionCardProps {
  conn: PlatformConnection;
  onConnect: (platform: Platform) => void;
  onDisconnect: (platform: Platform) => void;
  onSync: (platform: Platform) => void;
  syncing: Platform | null;
  connecting: Platform | null;
}

function ConnectionCard({ conn, onConnect, onDisconnect, onSync, syncing, connecting }: ConnectionCardProps) {
  const cfg = platformConfig[conn.platform];
  const isSyncing = syncing === conn.platform;
  const isConnecting = connecting === conn.platform;

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      conn.connected
        ? `${cfg.bg} ${cfg.border}`
        : 'bg-gray-800/30 border-gray-700/50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {conn.connected ? (
            <>
              <button
                onClick={() => onSync(conn.platform)}
                disabled={isSyncing}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
                title="סנכרון"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
              </button>
              <button
                onClick={() => onDisconnect(conn.platform)}
                className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded"
                title="נתק"
              >
                <Unlink size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={() => onConnect(conn.platform)}
              disabled={isConnecting}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              {isConnecting ? <RefreshCw size={12} className="animate-spin" /> : <Link size={12} />}
              {isConnecting ? 'מתחבר...' : 'חבר'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={cfg.color}>{cfg.icon}</div>
          {conn.connected ? (
            <CheckCircle2 size={15} className="text-green-400" />
          ) : (
            <XCircle size={15} className="text-gray-600" />
          )}
        </div>
      </div>

      <div className="text-right">
        <h3 className={`font-semibold text-sm ${conn.connected ? 'text-white' : 'text-gray-500'}`}>
          {cfg.label}
        </h3>
        {conn.connected ? (
          <>
            <p className="text-gray-400 text-xs mt-0.5">{conn.username}</p>
            <div className="flex items-center justify-end gap-3 mt-3">
              <div className="flex items-center gap-1 text-gray-400">
                <span className="text-xs">{conn.lastSync}</span>
                <span className="text-xs text-gray-600">סנכרון</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white text-sm font-bold">{formatFollowers(conn.followers!)}</span>
                <Users size={13} className="text-gray-500" />
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-600 text-xs mt-1">{cfg.description}</p>
        )}
      </div>
    </div>
  );
}

export function SocialMediaAgent({ agent }: SocialMediaAgentProps) {
  const [connections, setConnections] = useState<PlatformConnection[]>(
    agent.connections || []
  );
  const [syncing, setSyncing] = useState<Platform | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'analytics'>('overview');

  const handleConnect = (platform: Platform) => {
    setConnecting(platform);
    setTimeout(() => {
      setConnections(prev => prev.map(c =>
        c.platform === platform
          ? { ...c, connected: true, username: `@my_brand`, followers: 1200, lastSync: 'עכשיו' }
          : c
      ));
      setConnecting(null);
    }, 2000);
  };

  const handleDisconnect = (platform: Platform) => {
    setConnections(prev => prev.map(c =>
      c.platform === platform
        ? { platform, connected: false }
        : c
    ));
  };

  const handleSync = (platform: Platform) => {
    setSyncing(platform);
    setTimeout(() => {
      setConnections(prev => prev.map(c =>
        c.platform === platform ? { ...c, lastSync: 'עכשיו' } : c
      ));
      setSyncing(null);
    }, 1500);
  };

  const connectedCount = connections.filter(c => c.connected).length;
  const totalFollowers = connections
    .filter(c => c.connected && c.followers)
    .reduce((s, c) => s + (c.followers ?? 0), 0);

  const tabs = [
    { id: 'overview', label: 'סקירה' },
    { id: 'posts', label: 'פוסטים' },
    { id: 'analytics', label: 'ביצועים' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Agent Header */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">פעיל</span>
          </div>
          <div className="text-right">
            <h2 className="text-white font-bold text-lg">{agent.name}</h2>
            <p className="text-gray-500 text-sm mt-0.5">{agent.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            פוסט חדש
          </button>
          <div className="flex items-center gap-4 mr-auto">
            <div className="text-center">
              <p className="text-white font-bold">{connectedCount}</p>
              <p className="text-gray-600 text-xs">פלטפורמות</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold">{formatFollowers(totalFollowers)}</p>
              <p className="text-gray-600 text-xs">עוקבים</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold">{agent.tasksCompleted}</p>
              <p className="text-gray-600 text-xs">פוסטים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13151f] border border-gray-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Platform Connections */}
          <div>
            <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3 text-right">
              חיבורי פלטפורמות
            </h3>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {connections.map(conn => (
                <ConnectionCard
                  key={conn.platform}
                  conn={conn}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSync={handleSync}
                  syncing={syncing}
                  connecting={connecting}
                />
              ))}
            </div>
          </div>

          {/* Active Tasks */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4 text-right">משימות פעילות</h3>
            <div className="space-y-3">
              {[
                { task: 'מעקב אחר מנשנים ותגובה', platform: 'instagram' as Platform, progress: 68 },
                { task: 'פרסום תוכן מתוזמן', platform: 'twitter' as Platform, progress: 100 },
                { task: 'ניתוח ביצועי קמפיין', platform: 'linkedin' as Platform, progress: 42 },
              ].map(({ task, platform, progress }) => {
                const cfg = platformConfig[platform];
                return (
                  <div key={task} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{progress}%</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300 text-xs">{task}</span>
                          <span className={cfg.color}>{cfg.icon}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === 'posts' && (
        <PostList posts={mockPosts} onNewPost={() => setShowComposer(true)} />
      )}

      {activeTab === 'analytics' && <SocialAnalytics />}

      {showComposer && (
        <PostComposer
          connections={connections}
          onClose={() => setShowComposer(false)}
        />
      )}
    </div>
  );
}

function SocialAnalytics() {
  const metrics = [
    { label: 'רשמות כוללות', value: '48.2K', change: '+12.4%', icon: Eye, color: 'text-purple-400' },
    { label: 'לייקים', value: '3.1K', change: '+8.7%', icon: Heart, color: 'text-pink-400' },
    { label: 'שיתופים', value: '842', change: '+23.1%', icon: Repeat2, color: 'text-sky-400' },
    { label: 'תגובות', value: '291', change: '+5.2%', icon: MessageCircle, color: 'text-green-400' },
  ];

  const platformBreakdown = [
    { platform: 'instagram' as Platform, reach: 22400, engagement: '4.8%' },
    { platform: 'twitter' as Platform, reach: 15800, engagement: '2.3%' },
    { platform: 'linkedin' as Platform, reach: 10000, engagement: '6.1%' },
  ];

  const maxReach = 22400;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 text-right">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
                {change}
              </span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-white font-bold text-2xl">{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4 text-right">ביצועים לפי פלטפורמה</h3>
        <div className="space-y-3">
          {platformBreakdown.map(({ platform, reach, engagement }) => {
            const cfg = platformConfig[platform];
            return (
              <div key={platform} className="flex items-center gap-3">
                <div className="w-20 text-left">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-gray-500 text-xs">{engagement}</span>
                    <TrendingUp size={11} className="text-green-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.bg}`}
                      style={{ width: `${(reach / maxReach) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 w-28 justify-end">
                  <span className="text-gray-400 text-xs">{reach.toLocaleString()}</span>
                  <span className={cfg.color}>{cfg.icon}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
