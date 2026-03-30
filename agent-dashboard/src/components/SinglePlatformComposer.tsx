import { useState } from 'react';
import { X, Send, Clock, Image, Smile, Hash, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import type { Platform } from '../types';
import { platformMeta } from './PlatformAgentCard';
import { sendToZapier, sendToTelegram } from '../lib/zapier';

interface SinglePlatformComposerProps {
  platform: Platform;
  username: string;
  onClose: () => void;
}

type State = 'idle' | 'sending' | 'success' | 'error';

export function SinglePlatformComposer({ platform, username, onClose }: SinglePlatformComposerProps) {
  const [content, setContent] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const meta = platformMeta[platform];
  const maxChars = platform === 'twitter' ? 280 : 2200;
  const remaining = maxChars - content.length;

  const handlePublish = async () => {
    if (!content.trim()) return;
    setState('sending');
    setErrorMsg('');

    const payload = {
      content,
      platforms: [platform] as Platform[],
      schedule_mode: scheduleMode as 'now' | 'scheduled',
      scheduled_at: scheduleMode === 'scheduled' ? `${scheduleDate} ${scheduleTime}` : undefined,
      agent: `${meta.label} Agent`,
      timestamp: new Date().toISOString(),
    };

    // Telegram uses its own dedicated webhook
    const result = platform === 'telegram'
      ? await sendToTelegram(payload)
      : await sendToZapier(payload);

    if (result.ok) {
      setState('success');
      setTimeout(onClose, 2200);
    } else {
      setErrorMsg(result.error ?? 'שגיאה לא ידועה');
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#13151f] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

        {/* Colored header */}
        <div className={`bg-gradient-to-r ${meta.color} border-b border-gray-800 px-5 py-4`}>
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800/50">
              <X size={17} />
            </button>
            <div className="flex items-center gap-2 text-right">
              <div>
                <h2 className="text-white font-semibold text-sm">{meta.label} Agent</h2>
                <p className={`text-xs ${meta.textColor}`}>{username}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} ${meta.textColor}`}>
                {meta.iconLg}
              </div>
            </div>
          </div>
        </div>

        {/* Success state */}
        {state === 'success' ? (
          <div className="p-10 text-center">
            <div className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ${meta.bg}`}>
              <CheckCircle2 size={28} className="text-green-400" />
            </div>
            <p className="text-white font-semibold">
              {scheduleMode === 'now' ? `נשלח ל-${meta.label}!` : 'תוזמן בהצלחה!'}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Zap size={13} className="text-orange-400" />
              <span className="text-gray-500 text-sm">Zap הופעל</span>
            </div>
          </div>
        ) : (
          <>
            {/* Content editor */}
            <div className="p-5">
              <div className={`border rounded-xl p-3 mb-3 ${meta.border} bg-gray-800/20`}>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={`כתוב פוסט ל-${meta.label}...`}
                  maxLength={maxChars}
                  rows={5}
                  dir="rtl"
                  className="w-full bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none leading-relaxed"
                />
                <div className="flex items-center justify-between pt-2 border-t border-gray-700/50 mt-2">
                  <span className={`text-xs ${remaining < 30 ? 'text-red-400' : 'text-gray-600'}`}>
                    {remaining}
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-all"><Hash size={14} /></button>
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-all"><Smile size={14} /></button>
                    <button className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-all"><Image size={14} /></button>
                  </div>
                </div>
              </div>

              {/* Schedule toggle */}
              <div className="flex items-center gap-2 justify-end mb-3">
                <button
                  onClick={() => setScheduleMode('scheduled')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    scheduleMode === 'scheduled'
                      ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                      : 'text-gray-500 border-gray-700 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <Clock size={12} /> תזמן
                </button>
                <button
                  onClick={() => setScheduleMode('now')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    scheduleMode === 'now'
                      ? `${meta.bg} ${meta.textColor} ${meta.border}`
                      : 'text-gray-500 border-gray-700 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <Send size={12} /> עכשיו
                </button>
              </div>

              {scheduleMode === 'scheduled' && (
                <div className="flex gap-2 justify-end mb-3">
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Error */}
              {state === 'error' && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs">שגיאה: {errorMsg}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 pb-5">
              <button onClick={onClose} className="text-gray-500 hover:text-white text-sm transition-colors">
                ביטול
              </button>
              <button
                onClick={handlePublish}
                disabled={!content.trim() || state === 'sending'}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                  content.trim() && state !== 'sending'
                    ? scheduleMode === 'now'
                      ? `${meta.bg} ${meta.textColor} ${meta.border} border hover:opacity-80`
                      : 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {state === 'sending' ? (
                  <><Loader2 size={14} className="animate-spin" /> שולח...</>
                ) : scheduleMode === 'now' ? (
                  <><Zap size={14} /> פרסם ב-{meta.label}</>
                ) : (
                  <><Clock size={14} /> תזמן</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
