import { useState } from 'react';
import {
  X, Send, Clock, Image, CheckCircle2, AlertCircle, Loader2, Zap,
  ChevronDown, ChevronUp, Globe,
} from 'lucide-react';
import type { Platform, PlatformConnection } from '../types';
import { TwitterIcon, InstagramIcon, LinkedinIcon, FacebookIcon, TikTokIcon, TelegramIcon } from './SocialIcons';
import { sendToZapier, sendToTelegram } from '../lib/zapier';

interface PostComposerProps {
  connections: PlatformConnection[];
  onClose: () => void;
}

const platformIcons: Record<Platform, React.ReactNode> = {
  twitter:   <TwitterIcon size={14} />,
  instagram: <InstagramIcon size={14} />,
  linkedin:  <LinkedinIcon size={14} />,
  facebook:  <FacebookIcon size={14} />,
  tiktok:    <TikTokIcon size={14} />,
  telegram:  <TelegramIcon size={14} />,
};

const platformColors: Record<Platform, string> = {
  twitter:   'text-sky-400 border-sky-500/40 bg-sky-500/10',
  instagram: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  linkedin:  'text-blue-400 border-blue-500/40 bg-blue-500/10',
  facebook:  'text-blue-500 border-blue-600/40 bg-blue-600/10',
  tiktok:    'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-500/10',
  telegram:  'text-sky-300 border-sky-400/40 bg-sky-400/10',
};

const platformLabels: Record<Platform, string> = {
  twitter:   'Twitter',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  facebook:  'Facebook',
  tiktok:    'TikTok',
  telegram:  'Telegram',
};

/** Platforms that get per-platform content overrides by default */
const OVERRIDE_DEFAULTS: Partial<Record<Platform, { lang: 'he' | 'en'; placeholder: string }>> = {
  linkedin: { lang: 'en', placeholder: 'LinkedIn — write in English (professional tone)' },
  facebook: { lang: 'he', placeholder: 'Facebook — כתוב בעברית (טון חברתי)' },
};

interface PlatformOverride {
  content: string;
  lang: 'he' | 'en';
  open: boolean;
}

export function PostComposer({ connections, onClose }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImage, setShowImage] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    connections.filter(c => c.connected).map(c => c.platform)
  );
  const [overrides, setOverrides] = useState<Partial<Record<Platform, PlatformOverride>>>(() => {
    const init: Partial<Record<Platform, PlatformOverride>> = {};
    for (const [p, def] of Object.entries(OVERRIDE_DEFAULTS) as [Platform, { lang: 'he' | 'en'; placeholder: string }][]) {
      init[p] = { content: '', lang: def.lang, open: false };
    }
    return init;
  });
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [published, setPublished] = useState(false);
  const [sending, setSending] = useState(false);
  const [zapError, setZapError] = useState<string | null>(null);

  const connectedConnections = connections.filter(c => c.connected);
  const maxChars = selectedPlatforms.includes('twitter') ? 280 : 2200;
  const remaining = maxChars - content.length;

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const updateOverride = (platform: Platform, patch: Partial<PlatformOverride>) => {
    setOverrides(prev => ({
      ...prev,
      [platform]: { ...prev[platform]!, ...patch },
    }));
  };

  const getContentFor = (platform: Platform): string => {
    const ov = overrides[platform];
    if (ov && ov.content.trim()) return ov.content;
    return content;
  };

  const handlePublish = async () => {
    if (!content.trim() || selectedPlatforms.length === 0) return;
    setSending(true);
    setZapError(null);

    const base = {
      schedule_mode: scheduleMode as 'now' | 'scheduled',
      scheduled_at: scheduleMode === 'scheduled' ? `${scheduleDate} ${scheduleTime}` : undefined,
      image_url: imageUrl.trim() || undefined,
      agent: 'עידית — מנהלת השיווק',
      timestamp: new Date().toISOString(),
    };

    // Send each platform individually so overrides work correctly
    const jobs = selectedPlatforms.map(async platform => {
      const platformContent = getContentFor(platform);
      if (platform === 'telegram') {
        return sendToTelegram({ ...base, content: platformContent, platforms: [] });
      }
      return sendToZapier({ ...base, content: platformContent, platforms: [platform] });
    });

    const results = await Promise.all(jobs);
    setSending(false);

    const failed = results.find(r => !r.ok);
    if (failed) {
      setZapError(failed.error ?? 'שגיאה לא ידועה');
      return;
    }

    setPublished(true);
    setTimeout(onClose, 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#13151f] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-[#13151f] z-10">
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <X size={18} />
          </button>
          <h2 className="text-white font-semibold">יצירת פוסט חדש</h2>
        </div>

        {published ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <p className="text-white font-semibold text-lg">
              {scheduleMode === 'now' ? 'הפוסט נשלח ל-Zapier!' : 'הפוסט תוזמן בהצלחה!'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Zap size={14} className="text-orange-400" />
              <p className="text-gray-500 text-sm">Zap הופעל בהצלחה</p>
            </div>
          </div>
        ) : (
          <>
            {/* Platform selector */}
            <div className="p-5 border-b border-gray-800">
              <p className="text-gray-500 text-xs mb-3 text-right">פרסם ב:</p>
              <div className="flex gap-2 flex-wrap justify-end">
                {connectedConnections.map(conn => {
                  const isSelected = selectedPlatforms.includes(conn.platform);
                  const colorClass = platformColors[conn.platform];
                  return (
                    <button
                      key={conn.platform}
                      onClick={() => togglePlatform(conn.platform)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        isSelected ? colorClass : 'text-gray-500 border-gray-700 bg-transparent hover:border-gray-600'
                      }`}
                    >
                      {conn.username}
                      <span className={isSelected ? '' : 'opacity-40'}>{platformIcons[conn.platform]}</span>
                    </button>
                  );
                })}
                {connectedConnections.length === 0 && (
                  <p className="text-gray-600 text-xs">אין פלטפורמות מחוברות</p>
                )}
              </div>
            </div>

            {/* Main content editor */}
            <div className="p-5 border-b border-gray-800">
              <p className="text-gray-500 text-xs mb-2 text-right">תוכן ראשי (ברירת מחדל לכל הרשתות)</p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="מה תרצה לשתף?"
                maxLength={maxChars}
                className="w-full bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none text-right leading-relaxed"
                rows={4}
                dir="rtl"
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                <span className={`text-xs ${remaining < 20 ? 'text-red-400' : 'text-gray-600'}`}>{remaining}</span>
                <button
                  onClick={() => setShowImage(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                    showImage
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'text-gray-500 hover:text-gray-300 border border-gray-700'
                  }`}
                >
                  <Image size={13} />
                  תמונה
                </button>
              </div>

              {showImage && (
                <div className="mt-3">
                  <input
                    type="url"
                    dir="ltr"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://... (URL לתמונה)"
                    className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600 text-left font-mono"
                  />
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="preview"
                      className="mt-2 rounded-lg max-h-32 object-cover w-full border border-gray-700"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Per-platform overrides */}
            {selectedPlatforms.some(p => p in OVERRIDE_DEFAULTS) && (
              <div className="p-5 border-b border-gray-800 space-y-2">
                <div className="flex items-center gap-1.5 justify-end mb-1">
                  <p className="text-gray-500 text-xs">תוכן מותאם לפלטפורמה</p>
                  <Globe size={12} className="text-gray-500" />
                </div>

                {(selectedPlatforms.filter(p => p in OVERRIDE_DEFAULTS) as Platform[]).map(platform => {
                  const ov = overrides[platform];
                  if (!ov) return null;
                  const def = OVERRIDE_DEFAULTS[platform]!;
                  const hasOverride = ov.content.trim().length > 0;
                  return (
                    <div key={platform} className={`border rounded-xl overflow-hidden ${platformColors[platform].split(' ').find(c => c.startsWith('border')) ?? 'border-gray-700'}`}>
                      <button
                        onClick={() => updateOverride(platform, { open: !ov.open })}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/20 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          {ov.open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span className={`text-xs ${def.lang === 'en' ? 'text-blue-300' : 'text-green-300'}`}>
                            {def.lang === 'en' ? 'English' : 'עברית'}
                          </span>
                          {hasOverride && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {platformIcons[platform]}
                          <span className={`text-xs font-medium ${platformColors[platform].split(' ')[0]}`}>
                            {platformLabels[platform]}
                          </span>
                        </div>
                      </button>

                      {ov.open && (
                        <div className="border-t border-gray-800 p-3">
                          <textarea
                            value={ov.content}
                            onChange={e => updateOverride(platform, { content: e.target.value })}
                            placeholder={def.placeholder}
                            rows={3}
                            dir={def.lang === 'he' ? 'rtl' : 'ltr'}
                            className="w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600 resize-none border border-gray-700"
                          />
                          {!hasOverride && (
                            <p className="text-gray-600 text-xs mt-1.5 text-right">
                              ריק = ישתמש בתוכן הראשי
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Schedule options */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex gap-2 mb-3 justify-end">
                <button
                  onClick={() => setScheduleMode('scheduled')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scheduleMode === 'scheduled'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-gray-700'
                  }`}
                >
                  <Clock size={12} />
                  תזמן
                </button>
                <button
                  onClick={() => setScheduleMode('now')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scheduleMode === 'now'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-gray-700'
                  }`}
                >
                  <Send size={12} />
                  פרסם עכשיו
                </button>
              </div>

              {scheduleMode === 'scheduled' && (
                <div className="flex gap-2 justify-end">
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
            </div>

            {/* Zapier error */}
            {zapError && (
              <div className="mx-5 mb-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">שגיאה בחיבור ל-Zapier: {zapError}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-gray-800">
              <button onClick={onClose} className="text-gray-500 hover:text-white text-sm transition-colors">
                ביטול
              </button>
              <button
                onClick={handlePublish}
                disabled={!content.trim() || selectedPlatforms.length === 0 || sending}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  content.trim() && selectedPlatforms.length > 0 && !sending
                    ? scheduleMode === 'now'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {sending ? (
                  <><Loader2 size={14} className="animate-spin" /> שולח...</>
                ) : scheduleMode === 'now' ? (
                  <><Zap size={14} /> פרסם דרך Zapier ({selectedPlatforms.length})</>
                ) : (
                  <><Clock size={14} /> תזמן דרך Zapier</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
