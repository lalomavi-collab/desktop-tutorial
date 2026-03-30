import { useState } from 'react';
import {
  X, Zap, Clock, Plus, Trash2, CheckCircle2, AlertCircle,
  Loader2, Save, Send, ToggleLeft, ToggleRight, Link2,
  BookOpen, Hash, Smile, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Platform, PlatformAgent, PlatformAgentConfig, ScheduledTime, ContentStyle, EmojiStyle, HashtagStyle } from '../types';
import { platformMeta } from './PlatformAgentCard';
import { PLATFORM_WEBHOOKS, TELEGRAM_WEBHOOK } from '../lib/zapier';

interface PlatformAgentDetailProps {
  agent: PlatformAgent;
  config: PlatformAgentConfig;
  onClose: () => void;
  onSaveConfig: (platform: Platform, config: PlatformAgentConfig) => void;
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const CONTENT_STYLES: { value: ContentStyle; label: string; desc: string }[] = [
  { value: 'professional', label: 'מקצועי', desc: 'טון עסקי, רשמי' },
  { value: 'casual',       label: 'קז\'ואל',  desc: 'ידידותי, שיחתי' },
  { value: 'news',         label: 'חדשותי',  desc: 'עובדות, ידיעות' },
  { value: 'promotional',  label: 'פרסומי',  desc: 'מכירות, מבצעים' },
  { value: 'educational',  label: 'חינוכי',  desc: 'הסברים, טיפים' },
  { value: 'inspirational',label: 'מעורר',   desc: 'השראה, ציטוטים' },
];

const EMOJI_OPTIONS: { value: EmojiStyle; label: string }[] = [
  { value: 'none',    label: 'ללא' },
  { value: 'minimal', label: 'מועט' },
  { value: 'rich',    label: 'עשיר' },
];

const HASHTAG_OPTIONS: { value: HashtagStyle; label: string }[] = [
  { value: 'none', label: 'ללא' },
  { value: 'few',  label: '1-3' },
  { value: 'many', label: '5+' },
];

function defaultWebhook(platform: Platform): string {
  if (platform === 'telegram') return TELEGRAM_WEBHOOK;
  return (PLATFORM_WEBHOOKS[platform] as string | undefined) ?? '';
}

let nextId = 1;
function uid() { return `t-${Date.now()}-${nextId++}`; }

export function PlatformAgentDetail({ agent, config: initialConfig, onClose, onSaveConfig }: PlatformAgentDetailProps) {
  const meta = platformMeta[agent.platform];
  const [cfg, setCfg] = useState<PlatformAgentConfig>({
    ...initialConfig,
    webhookUrl: initialConfig.webhookUrl ?? defaultWebhook(agent.platform),
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [schedOpen, setSchedOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);

  // ── Webhook ──────────────────────────────────────────────────────────────
  const handleTestWebhook = async () => {
    if (!cfg.webhookUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `בדיקת חיבור — ${meta.label} ✅`,
          platforms: [agent.platform],
          schedule_mode: 'now',
          agent: 'עידית — מנהלת השיווק',
          timestamp: new Date().toISOString(),
          _test: true,
        }),
      });
      setTestResult(res.ok ? { ok: true, msg: 'Webhook פעיל! ✅' } : { ok: false, msg: `HTTP ${res.status}` });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'שגיאת רשת' });
    }
    setTesting(false);
  };

  // ── Schedule ─────────────────────────────────────────────────────────────
  const addTime = () => {
    setCfg(prev => ({
      ...prev,
      scheduledTimes: [...prev.scheduledTimes, {
        id: uid(), dayOfWeek: 0, hour: 9, minute: 0, active: true,
      }],
    }));
  };

  const removeTime = (id: string) => {
    setCfg(prev => ({ ...prev, scheduledTimes: prev.scheduledTimes.filter(t => t.id !== id) }));
  };

  const updateTime = (id: string, patch: Partial<ScheduledTime>) => {
    setCfg(prev => ({
      ...prev,
      scheduledTimes: prev.scheduledTimes.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    onSaveConfig(agent.platform, cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isConnected = agent.connection.connected;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-end z-50">
      <div className="w-full max-w-md h-full bg-[#0d0f18] border-l border-gray-800 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${meta.color}`} />
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 text-right">
            <div>
              <h2 className="text-white font-bold text-base">{meta.label} Agent</h2>
              {isConnected
                ? <p className={`text-xs ${meta.textColor}`}>{agent.connection.username}</p>
                : <p className="text-xs text-gray-600">לא מחובר</p>
              }
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bg} ${meta.textColor}`}>
              {meta.iconLg}
            </div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5">

          {/* Auto-post toggle */}
          <div className="flex items-center justify-between bg-[#13151f] border border-gray-800 rounded-xl p-4">
            <button
              onClick={() => setCfg(prev => ({ ...prev, autoPost: !prev.autoPost }))}
              className={`transition-colors ${cfg.autoPost ? meta.textColor : 'text-gray-600'}`}
            >
              {cfg.autoPost ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
            <div className="text-right">
              <p className="text-white text-sm font-semibold">פרסום אוטומטי</p>
              <p className="text-gray-500 text-xs">הסוכן מפרסם לפי הלוח שהגדרת</p>
            </div>
          </div>

          {/* Webhook */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-orange-400" />
                <span className="text-orange-400 text-xs font-medium">Zapier Webhook</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link2 size={13} className={meta.textColor} />
                <span className="text-white text-sm font-semibold">חיבור ישיר</span>
              </div>
            </div>

            <input
              type="url"
              dir="ltr"
              value={cfg.webhookUrl ?? ''}
              onChange={e => setCfg(prev => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-orange-500 placeholder-gray-600 text-left font-mono"
            />

            <button
              onClick={handleTestWebhook}
              disabled={testing || !cfg.webhookUrl}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                cfg.webhookUrl
                  ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {testing
                ? <><Loader2 size={12} className="animate-spin" /> בודק...</>
                : <><Send size={12} /> שלח הודעת בדיקה</>
              }
            </button>

            {testResult && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                testResult.ok
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {testResult.msg}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setSchedOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            >
              <div className="flex items-center gap-1 text-gray-500">
                {schedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span className="text-xs">{cfg.scheduledTimes.length} זמנים מוגדרים</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-purple-400" />
                <span className="text-white text-sm font-semibold">לוח זמנים</span>
              </div>
            </button>

            {schedOpen && (
              <div className="border-t border-gray-800 p-4 space-y-3">
                {cfg.scheduledTimes.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-2">אין זמנים — לחץ + להוסיף</p>
                )}

                {cfg.scheduledTimes.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5">
                    {/* Active toggle */}
                    <button
                      onClick={() => updateTime(t.id, { active: !t.active })}
                      className={`flex-shrink-0 ${t.active ? meta.textColor : 'text-gray-600'}`}
                    >
                      <span className={`w-2 h-2 rounded-full inline-block ${t.active ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                    </button>

                    {/* Day */}
                    <select
                      value={t.dayOfWeek}
                      onChange={e => updateTime(t.id, { dayOfWeek: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none flex-1"
                      dir="rtl"
                    >
                      {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>

                    {/* Hour */}
                    <select
                      value={t.hour}
                      onChange={e => updateTime(t.id, { hour: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none w-16"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                      ))}
                    </select>

                    {/* Minute */}
                    <select
                      value={t.minute}
                      onChange={e => updateTime(t.id, { minute: Number(e.target.value) })}
                      className="bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none w-14"
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>

                    <button onClick={() => removeTime(t.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addTime}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-xs transition-all"
                >
                  <Plus size={13} />
                  הוסף זמן פרסום
                </button>

                <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                  <Clock size={11} />
                  <span>כל הזמנים בשעון ישראל (Asia/Jerusalem)</span>
                </div>
              </div>
            )}
          </div>

          {/* Content style */}
          <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setStyleOpen(v => !v)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            >
              <div className="flex items-center gap-1 text-gray-500">
                {styleOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span className={`text-xs capitalize ${meta.textColor}`}>
                  {CONTENT_STYLES.find(s => s.value === cfg.contentStyle)?.label ?? cfg.contentStyle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-green-400" />
                <span className="text-white text-sm font-semibold">סגנון תוכן</span>
              </div>
            </button>

            {styleOpen && (
              <div className="border-t border-gray-800 p-4 space-y-4">
                {/* Style grid */}
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setCfg(prev => ({ ...prev, contentStyle: s.value }))}
                      className={`flex flex-col items-center py-2.5 px-2 rounded-lg border text-xs transition-all ${
                        cfg.contentStyle === s.value
                          ? `${meta.bg} ${meta.textColor} ${meta.border}`
                          : 'border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      <span className="font-semibold">{s.label}</span>
                      <span className="text-gray-600 text-xs mt-0.5">{s.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Emoji + Hashtag */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end mb-1.5">
                      <span className="text-gray-500 text-xs">אמוג&#39;י</span>
                      <Smile size={12} className="text-gray-500" />
                    </div>
                    <div className="flex gap-1">
                      {EMOJI_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          onClick={() => setCfg(prev => ({ ...prev, emojiStyle: o.value }))}
                          className={`flex-1 py-1.5 rounded text-xs transition-all ${
                            cfg.emojiStyle === o.value
                              ? `${meta.bg} ${meta.textColor}`
                              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end mb-1.5">
                      <span className="text-gray-500 text-xs">האשטאגים</span>
                      <Hash size={12} className="text-gray-500" />
                    </div>
                    <div className="flex gap-1">
                      {HASHTAG_OPTIONS.map(o => (
                        <button
                          key={o.value}
                          onClick={() => setCfg(prev => ({ ...prev, hashtagStyle: o.value }))}
                          className={`flex-1 py-1.5 rounded text-xs transition-all ${
                            cfg.hashtagStyle === o.value
                              ? `${meta.bg} ${meta.textColor}`
                              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Max posts per day */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {[1,2,3,5,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setCfg(prev => ({ ...prev, maxPostsPerDay: n }))}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          cfg.maxPostsPerDay === n
                            ? `${meta.bg} ${meta.textColor}`
                            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-gray-500 text-xs">מקסימום פוסטים ביום</span>
                </div>

                {/* Post template */}
                <div className="text-right">
                  <label className="text-gray-500 text-xs block mb-1.5">הוראות לסוכן (אופציונלי)</label>
                  <textarea
                    value={cfg.postTemplate ?? ''}
                    onChange={e => setCfg(prev => ({ ...prev, postTemplate: e.target.value }))}
                    placeholder={`לדוגמה: תמיד כלול קריאה לפעולה. התייחס לערכי המותג. פרסם בעברית.`}
                    rows={3}
                    dir="rtl"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — save */}
        <div className="p-5 border-t border-gray-800 bg-[#0d0f18]">
          <button
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : `bg-gradient-to-r ${meta.color.replace('/20', '/40').replace('/10', '/20')} border ${meta.border} ${meta.textColor} hover:opacity-90`
            }`}
          >
            {saved
              ? <><CheckCircle2 size={16} /> הגדרות נשמרו!</>
              : <><Save size={16} /> שמור הגדרות סוכן</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/** Build a default config for a platform (used the first time) */
export function defaultConfig(platform: Platform): PlatformAgentConfig {
  const defaults: Record<Platform, Partial<PlatformAgentConfig>> = {
    twitter:   { contentStyle: 'casual',        maxPostsPerDay: 3, hashtagStyle: 'few',  emojiStyle: 'minimal' },
    instagram: { contentStyle: 'inspirational', maxPostsPerDay: 2, hashtagStyle: 'many', emojiStyle: 'rich'    },
    linkedin:  { contentStyle: 'professional',  maxPostsPerDay: 1, hashtagStyle: 'few',  emojiStyle: 'none'    },
    facebook:  { contentStyle: 'promotional',   maxPostsPerDay: 2, hashtagStyle: 'few',  emojiStyle: 'minimal' },
    tiktok:    { contentStyle: 'casual',         maxPostsPerDay: 1, hashtagStyle: 'many', emojiStyle: 'rich'    },
    telegram:  { contentStyle: 'news',           maxPostsPerDay: 5, hashtagStyle: 'none', emojiStyle: 'minimal' },
  };
  return {
    platform,
    webhookUrl: platform === 'telegram' ? TELEGRAM_WEBHOOK : ((PLATFORM_WEBHOOKS[platform] as string | undefined) ?? ''),
    contentStyle: 'casual',
    /** Every Saturday at 19:00 Israel time — fixed weekly cadence */
    scheduledTimes: [{
      id: `default-sat-${platform}`,
      dayOfWeek: 6, // שבת
      hour: 19,
      minute: 0,
      active: true,
      label: 'שבת 19:00 — פוסט שבועי',
    }],
    autoPost: false,
    maxPostsPerDay: 1,
    hashtagStyle: 'few',
    emojiStyle: 'minimal',
    ...defaults[platform],
  };
}
