import { useState } from 'react';
import {
  Bot, CheckCircle2, Zap, TrendingUp, Clock, AlertCircle,
  Calendar, Send, Users, ThumbsUp, ThumbsDown, RefreshCw,
  Play, Pause, Loader2, Activity, FileText
} from 'lucide-react';
import type { Agent, ActivityItem, QueuedPost } from '../types';

interface MainDashboardProps {
  agents: Agent[];
  activities: ActivityItem[];
  queuedPosts: QueuedPost[];
  onSelectAgent: (id: string) => void;
}

const platformEmoji: Record<string, string> = {
  facebook: '📘',
  telegram: '✈️',
  instagram: '📸',
  linkedin: '💼',
  twitter: '🐦',
  tiktok: '🎵',
};

const platformColor: Record<string, string> = {
  facebook: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  telegram: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  linkedin: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  twitter: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  tiktok: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
};

const statusConfig = {
  active: { label: 'פעיל', color: 'text-green-400', bg: 'bg-green-500/10', dot: 'bg-green-500', icon: Play },
  idle: { label: 'ממתין', color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', icon: Clock },
  paused: { label: 'מושהה', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-500', icon: Pause },
  error: { label: 'שגיאה', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500', icon: AlertCircle },
};

function formatDate(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${platformColor[platform] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {platformEmoji[platform]} {platform}
    </span>
  );
}

function QueueCard({ post, onApprove, onReject }: {
  post: QueuedPost;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = post.status === 'pending';
  const isFailed = post.status === 'failed';
  const isApproved = post.status === 'approved';

  return (
    <div className={`bg-[#13151f] border rounded-xl p-4 transition-all ${isPending ? 'border-amber-500/40 hover:border-amber-500/60' : isFailed ? 'border-red-500/30' : 'border-gray-800 hover:border-gray-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              ממתין לאישור
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
              <AlertCircle size={11} /> נכשל
            </span>
          )}
          {isApproved && post.scheduledFor && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30">
              <Calendar size={11} /> {formatDate(post.scheduledFor)}
            </span>
          )}
        </div>
        <span className="text-gray-600 text-xs">{post.topic}</span>
      </div>

      <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-3 text-right whitespace-pre-line">
        {post.content}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {post.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
        </div>
        {isPending && (
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
            >
              <ThumbsDown size={12} /> דחה
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all"
            >
              <ThumbsUp size={12} /> אשר
            </button>
          </div>
        )}
        {isFailed && (
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all mr-2">
            <RefreshCw size={12} /> שלח מחדש
          </button>
        )}
      </div>
    </div>
  );
}

function AgentMiniCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const status = statusConfig[agent.status];
  return (
    <button
      onClick={onClick}
      className="bg-[#13151f] border border-gray-800 rounded-xl p-4 text-right w-full hover:border-gray-600 hover:bg-[#161925] transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${status.color} ${status.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
          {status.label}
        </div>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
          <Bot size={15} className="text-purple-400" />
        </div>
      </div>
      <h3 className="text-white font-semibold text-sm mb-1 leading-tight">{agent.name}</h3>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {agent.tasksRunning > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Loader2 size={11} className="animate-spin" />{agent.tasksRunning}
            </span>
          )}
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle2 size={11} />{agent.tasksCompleted.toLocaleString()}
          </span>
        </div>
        <span className="text-gray-600 text-xs">{agent.lastActive}</span>
      </div>
    </button>
  );
}

export function MainDashboard({ agents, activities, queuedPosts, onSelectAgent }: MainDashboardProps) {
  const [posts, setPosts] = useState(queuedPosts);

  const pendingPosts = posts.filter(p => p.status === 'pending');
  const approvedPosts = posts.filter(p => p.status === 'approved' && p.scheduledFor);
  const failedPosts = posts.filter(p => p.status === 'failed');

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksCompleted, 0);
  const runningTasks = agents.reduce((s, a) => s + a.tasksRunning, 0);

  const totalFollowers = agents
    .flatMap(a => a.platformAgents ?? [])
    .reduce((s, pa) => s + (pa.connection.followers ?? 0), 0);

  const handleApprove = (id: string) =>
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
  const handleReject = (id: string) =>
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected' } : p));

  const now = new Date('2026-05-10');
  const hebrewDate = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const stats = [
    {
      label: 'ממתינים לאישור',
      value: pendingPosts.length,
      icon: FileText,
      color: pendingPosts.length > 0 ? 'text-amber-400' : 'text-gray-500',
      bg: pendingPosts.length > 0 ? 'bg-amber-500/10' : 'bg-gray-500/10',
      pulse: pendingPosts.length > 0,
    },
    {
      label: 'מתוזמנים',
      value: approvedPosts.length,
      icon: Calendar,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      pulse: false,
    },
    {
      label: 'משימות רצות',
      value: runningTasks,
      icon: Zap,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      pulse: runningTasks > 0,
    },
    {
      label: 'סוכנים פעילים',
      value: `${activeAgents}/${agents.length}`,
      icon: Bot,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      pulse: false,
    },
    {
      label: 'עוקבים סה"כ',
      value: totalFollowers.toLocaleString(),
      icon: Users,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      pulse: false,
    },
    {
      label: 'משימות הושלמו',
      value: totalTasks.toLocaleString(),
      icon: TrendingUp,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      pulse: false,
    },
  ];

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            מערכת פעילה
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-white font-bold text-2xl">שולחן עבודה ראשי</h1>
          <p className="text-gray-500 text-sm mt-0.5">{hebrewDate}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, pulse }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center self-end`}>
              {pulse ? (
                <div className="relative flex">
                  <Icon size={16} className={color} />
                  <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${color.replace('text-', 'bg-')} animate-ping opacity-75`} />
                </div>
              ) : (
                <Icon size={16} className={color} />
              )}
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-xl leading-tight">{value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Left: Posts queue */}
        <div className="col-span-2 space-y-5">
          {/* Pending approval */}
          {pendingPosts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-amber-400 text-xs font-medium">{pendingPosts.length} פוסטים</span>
                <h2 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  ממתינים לאישור שלך
                </h2>
              </div>
              <div className="space-y-3">
                {pendingPosts.map(post => (
                  <QueueCard
                    key={post.id}
                    post={post}
                    onApprove={() => handleApprove(post.id)}
                    onReject={() => handleReject(post.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled posts */}
          {approvedPosts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-blue-400 text-xs font-medium">{approvedPosts.length} פוסטים</span>
                <h2 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
                  <Calendar size={14} className="text-blue-400" />
                  מתוזמנים לפרסום
                </h2>
              </div>
              <div className="space-y-3">
                {approvedPosts.map(post => (
                  <QueueCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* Failed posts */}
          {failedPosts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-red-400 text-xs font-medium">{failedPosts.length} פוסטים</span>
                <h2 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-400" />
                  פרסום נכשל
                </h2>
              </div>
              <div className="space-y-3">
                {failedPosts.map(post => (
                  <QueueCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {pendingPosts.length === 0 && approvedPosts.length === 0 && failedPosts.length === 0 && (
            <div className="bg-[#13151f] border border-gray-800 rounded-xl p-10 text-center">
              <Send size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">אין פוסטים בתור</p>
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <div>
          <div className="flex items-center justify-end gap-2 mb-3">
            <h2 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
              <Activity size={14} className="text-purple-400" />
              פעילות אחרונה
            </h2>
          </div>
          <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
            {activities.map((item, i) => (
              <div
                key={item.id}
                className={`p-4 text-right ${i < activities.length - 1 ? 'border-b border-gray-800/60' : ''}`}
              >
                <div className="flex items-start gap-3 flex-row-reverse">
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${item.status === 'success' ? 'bg-green-500/15' : item.status === 'error' ? 'bg-red-500/15' : 'bg-blue-500/15'}`}>
                    {item.status === 'success' && <CheckCircle2 size={13} className="text-green-400" />}
                    {item.status === 'error' && <AlertCircle size={13} className="text-red-400" />}
                    {item.status === 'info' && <Zap size={13} className="text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{item.agentName}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{item.action}</p>
                    <p className="text-gray-600 text-xs mt-0.5 truncate">{item.detail}</p>
                  </div>
                </div>
                <p className="text-gray-700 text-xs mt-2 text-left">{item.timestamp}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agents grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-500 text-xs">{activeAgents} פעילים</span>
          <h2 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
            <Bot size={14} className="text-purple-400" />
            הסוכנים שלי
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {agents.map(agent => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              onClick={() => onSelectAgent(agent.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
