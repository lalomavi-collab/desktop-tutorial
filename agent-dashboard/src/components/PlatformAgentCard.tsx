import { useState } from 'react';
import {
  CheckCircle2, RefreshCw, Users, Calendar,
  Send, TrendingUp, Link, Unlink, Zap, ChevronRight
} from 'lucide-react';
import type { PlatformAgent, Platform } from '../types';
import {
  TwitterIcon, InstagramIcon, LinkedinIcon, FacebookIcon, TikTokIcon, TelegramIcon,
} from './SocialIcons';
import { SinglePlatformComposer } from './SinglePlatformComposer';

interface PlatformAgentCardProps {
  agent: PlatformAgent;
  onConnect: (platform: Platform) => void;
  onDisconnect: (platform: Platform) => void;
  onSync: (platform: Platform) => void;
  onOpenDetail: (platform: Platform) => void;
  syncing: Platform | null;
  connecting: Platform | null;
}

export const platformMeta: Record<Platform, {
  label: string;
  color: string;
  textColor: string;
  bg: string;
  border: string;
  glowColor: string;
  icon: React.ReactNode;
  iconLg: React.ReactNode;
}> = {
  twitter: {
    label: 'Twitter / X',
    color: 'from-sky-500/20 to-sky-600/10',
    textColor: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    glowColor: 'shadow-sky-500/20',
    icon: <TwitterIcon size={14} />,
    iconLg: <TwitterIcon size={22} />,
  },
  instagram: {
    label: 'Instagram',
    color: 'from-pink-500/20 to-fuchsia-600/10',
    textColor: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    glowColor: 'shadow-pink-500/20',
    icon: <InstagramIcon size={14} />,
    iconLg: <InstagramIcon size={22} />,
  },
  linkedin: {
    label: 'LinkedIn',
    color: 'from-blue-500/20 to-blue-600/10',
    textColor: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
    icon: <LinkedinIcon size={14} />,
    iconLg: <LinkedinIcon size={22} />,
  },
  facebook: {
    label: 'Facebook',
    color: 'from-blue-600/20 to-indigo-600/10',
    textColor: 'text-blue-500',
    bg: 'bg-blue-600/10',
    border: 'border-blue-600/30',
    glowColor: 'shadow-blue-600/20',
    icon: <FacebookIcon size={14} />,
    iconLg: <FacebookIcon size={22} />,
  },
  tiktok: {
    label: 'TikTok',
    color: 'from-fuchsia-500/20 to-purple-600/10',
    textColor: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
    glowColor: 'shadow-fuchsia-500/20',
    icon: <TikTokIcon size={14} />,
    iconLg: <TikTokIcon size={22} />,
  },
  telegram: {
    label: 'Telegram',
    color: 'from-sky-400/20 to-blue-500/10',
    textColor: 'text-sky-300',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
    glowColor: 'shadow-sky-400/20',
    icon: <TelegramIcon size={14} />,
    iconLg: <TelegramIcon size={22} />,
  },
};

function formatFollowers(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

const statusDot: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-500',
  paused: 'bg-gray-500',
  error: 'bg-red-500',
};

export function PlatformAgentCard({
  agent, onConnect, onDisconnect, onSync, onOpenDetail, syncing, connecting,
}: PlatformAgentCardProps) {
  const [showComposer, setShowComposer] = useState(false);
  const meta = platformMeta[agent.platform];
  const isConnected = agent.connection.connected;
  const isSyncing = syncing === agent.platform;
  const isConnecting = connecting === agent.platform;

  return (
    <>
      <div
        className={`relative bg-[#13151f] border rounded-xl overflow-hidden transition-all hover:shadow-lg ${
          isConnected ? `${meta.border} hover:${meta.glowColor}` : 'border-gray-800'
        }`}
      >
        {/* Gradient strip at top */}
        <div className={`h-1 w-full bg-gradient-to-r ${isConnected ? meta.color : 'from-gray-800 to-gray-800'}`} />

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-4">
            {/* Status + action buttons */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${statusDot[agent.status]} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
              {isConnected ? (
                <>
                  <button
                    onClick={() => onSync(agent.platform)}
                    disabled={isSyncing}
                    className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
                    title="סנכרן"
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin text-purple-400' : ''} />
                  </button>
                  <button
                    onClick={() => onDisconnect(agent.platform)}
                    className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                    title="נתק"
                  >
                    <Unlink size={12} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onConnect(agent.platform)}
                  disabled={isConnecting}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-2 py-1 rounded-md transition-all"
                >
                  {isConnecting
                    ? <RefreshCw size={11} className="animate-spin" />
                    : <Link size={11} />}
                  {isConnecting ? 'מתחבר...' : 'חבר'}
                </button>
              )}
            </div>

            {/* Platform icon */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.bg} ${meta.textColor}`}>
              {meta.iconLg}
            </div>
          </div>

          {/* Platform name + username */}
          <div className="text-right mb-4">
            <h3 className="text-white font-semibold text-sm">{meta.label} Agent</h3>
            {isConnected
              ? <p className={`text-xs mt-0.5 ${meta.textColor}`}>{agent.connection.username}</p>
              : <p className="text-xs text-gray-600 mt-0.5">לא מחובר</p>
            }
          </div>

          {/* Stats */}
          {isConnected ? (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center bg-gray-800/40 rounded-lg py-2">
                <div className="flex items-center justify-center gap-1 text-white">
                  <Users size={11} className="text-gray-500" />
                  <span className="text-xs font-bold">{formatFollowers(agent.connection.followers ?? 0)}</span>
                </div>
                <p className="text-gray-600 text-xs mt-0.5">עוקבים</p>
              </div>
              <div className="text-center bg-gray-800/40 rounded-lg py-2">
                <div className="flex items-center justify-center gap-1 text-white">
                  <Send size={11} className="text-gray-500" />
                  <span className="text-xs font-bold">{agent.postsToday}</span>
                </div>
                <p className="text-gray-600 text-xs mt-0.5">היום</p>
              </div>
              <div className="text-center bg-gray-800/40 rounded-lg py-2">
                <div className="flex items-center justify-center gap-1 text-white">
                  <Calendar size={11} className="text-gray-500" />
                  <span className="text-xs font-bold">{agent.scheduledPosts}</span>
                </div>
                <p className="text-gray-600 text-xs mt-0.5">ממתינים</p>
              </div>
            </div>
          ) : (
            <div className="h-14 flex items-center justify-center mb-4">
              <p className="text-gray-700 text-xs">חבר כדי לראות נתונים</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <button
                  onClick={() => setShowComposer(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${meta.bg} ${meta.textColor} hover:opacity-80`}
                >
                  <Zap size={12} />
                  פרסם
                </button>
                <button
                  onClick={() => onOpenDetail(agent.platform)}
                  className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 transition-all"
                >
                  <TrendingUp size={12} />
                  <ChevronRight size={11} />
                </button>
              </>
            ) : (
              <button
                onClick={() => onConnect(agent.platform)}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-400 bg-gray-800/60 hover:bg-gray-700 transition-all"
              >
                <CheckCircle2 size={12} />
                חבר חשבון
              </button>
            )}
          </div>

          {/* Sync status */}
          {isConnected && agent.connection.lastSync && (
            <p className="text-gray-700 text-xs text-center mt-2">
              סנכרון אחרון: {agent.connection.lastSync}
            </p>
          )}
        </div>
      </div>

      {showComposer && (
        <SinglePlatformComposer
          platform={agent.platform}
          username={agent.connection.username ?? ''}
          onClose={() => setShowComposer(false)}
        />
      )}
    </>
  );
}
