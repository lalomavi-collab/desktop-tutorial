import { useState } from 'react';
import {
  Clock, Globe, Info, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import type { Platform } from '../types';

interface ScheduleConfigProps {
  platforms: Platform[];
  onSave: (config: ScheduleSettings) => void;
}

export interface ScheduleSettings {
  enabled: boolean;
  dayOfWeek: number; // 0=Sun, 6=Sat
  hour: number;
  minute: number;
  timezone: 'Asia/Jerusalem';
  utcHour: number; // computed
  platforms: Platform[];
  contentSource: 'manual' | 'google_sheet';
  googleSheetUrl?: string;
}

function getUtcHour(hour: number, isDst: boolean) {
  // Israel: UTC+3 summer (DST), UTC+2 winter
  return isDst ? hour - 3 : hour - 2;
}

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Israel DST: last Sunday March → last Sunday October
function isIsraelDst(month: number) {
  return month >= 3 && month <= 9; // approx
}

export function ScheduleConfig({ platforms, onSave }: ScheduleConfigProps) {
  const [enabled, setEnabled] = useState(true);
  const [day, setDay] = useState(6); // Saturday
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [contentSource, setContentSource] = useState<'manual' | 'google_sheet'>('google_sheet');
  const [sheetUrl, setSheetUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(platforms);
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(false);

  const nowMonth = new Date().getMonth() + 1;
  const isDst = isIsraelDst(nowMonth);
  const utcHour = getUtcHour(hour, isDst);

  const handleSave = () => {
    onSave({
      enabled,
      dayOfWeek: day,
      hour,
      minute,
      timezone: 'Asia/Jerusalem',
      utcHour,
      platforms: selectedPlatforms,
      contentSource,
      googleSheetUrl: sheetUrl || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const platformLabels: Record<Platform, string> = {
    twitter: 'Twitter',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    tiktok: 'TikTok',
  };

  return (
    <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-gray-400 text-xs">
            {enabled
              ? `${DAYS[day]} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} ישראל`
              : 'לא פעיל'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-purple-400" />
          <span className="text-white text-sm font-semibold">לוח זמנים</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-700 peer-checked:bg-purple-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
            </label>
            <span className="text-white text-sm font-medium">פרסום אוטומטי שבועי</span>
          </div>

          {/* Day + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-right">
              <label className="text-gray-500 text-xs block mb-1.5">יום בשבוע</label>
              <select
                value={day}
                onChange={e => setDay(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 text-right"
                dir="rtl"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <label className="text-gray-500 text-xs block mb-1.5">שעה (שעון ישראל)</label>
              <div className="flex gap-2">
                <select
                  value={minute}
                  onChange={e => setMinute(Number(e.target.value))}
                  className="w-20 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-2 py-2.5 outline-none focus:border-purple-500"
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2,'0')}</option>
                  ))}
                </select>
                <select
                  value={hour}
                  onChange={e => setHour(Number(e.target.value))}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-purple-500"
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* UTC note */}
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <Globe size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-right flex-1">
              <p className="text-blue-300 text-xs font-medium">
                הגדרה ב-Zapier: {String(utcHour).padStart(2,'0')}:00 UTC
              </p>
              <p className="text-blue-500 text-xs mt-0.5">
                {isDst ? 'קיץ (UTC+3)' : 'חורף (UTC+2)'} — בדוק עם שינוי שעון
              </p>
            </div>
          </div>

          {/* Platforms */}
          <div className="text-right">
            <label className="text-gray-500 text-xs block mb-2">פרסם ברשתות</label>
            <div className="flex flex-wrap gap-2 justify-end">
              {(Object.keys(platformLabels) as Platform[]).map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    selectedPlatforms.includes(p)
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'text-gray-600 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {platformLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Content source */}
          <div className="text-right">
            <label className="text-gray-500 text-xs block mb-2">מקור תוכן</label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setContentSource('manual')}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  contentSource === 'manual'
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
              >
                ידני
              </button>
              <button
                onClick={() => setContentSource('google_sheet')}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  contentSource === 'google_sheet'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
              >
                Google Sheets
              </button>
            </div>

            {contentSource === 'google_sheet' && (
              <div className="mt-3">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  dir="ltr"
                  className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600 text-left"
                />
                <GoogleSheetGuide />
              </div>
            )}
          </div>

          {/* Zapier setup summary */}
          <ZapierSetupCard
            day={DAYS[day]}
            hour={hour}
            minute={minute}
            utcHour={utcHour}
            isDst={isDst}
            platforms={selectedPlatforms}
          />

          {/* Save */}
          <button
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {saved ? <><CheckCircle2 size={15} /> נשמר!</> : 'שמור הגדרות'}
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleSheetGuide() {
  return (
    <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-right border border-gray-700/50">
      <p className="text-gray-400 text-xs font-medium mb-2 flex items-center gap-1 justify-end">
        <Info size={11} />
        מבנה הגיליון הנדרש
      </p>
      <div className="grid grid-cols-4 gap-1 text-xs">
        {['A: תאריך', 'B: תוכן', 'C: תמונה URL', 'D: סטטוס'].map(col => (
          <div key={col} className="bg-gray-700/50 rounded px-2 py-1 text-gray-400 text-center">{col}</div>
        ))}
      </div>
      <p className="text-gray-600 text-xs mt-2">
        Zapier קורא שורה לפי תאריך ומסמן "published" אחרי פרסום
      </p>
    </div>
  );
}

interface ZapierSetupCardProps {
  day: string;
  hour: number;
  minute: number;
  utcHour: number;
  isDst: boolean;
  platforms: Platform[];
}

function ZapierSetupCard({ day, minute, utcHour, isDst, platforms }: ZapierSetupCardProps) {
  const [open, setOpen] = useState(false);

  const platformActions: Record<Platform, string> = {
    twitter: 'Twitter V2 → Create Tweet',
    instagram: 'Instagram for Business → Create Photo Post',
    linkedin: 'LinkedIn → Create Share Update',
    facebook: 'Facebook Pages → Create Page Post',
    tiktok: 'TikTok → Create Video Post ⚠️',
  };

  return (
    <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-3 text-right"
      >
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          הצג הוראות Zapier
        </div>
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-orange-400" />
          <span className="text-orange-400 text-xs font-medium">הגדרת Zapier</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-orange-500/20 p-4 space-y-3 text-right">
          <div>
            <p className="text-white text-xs font-semibold mb-1">Trigger</p>
            <div className="bg-gray-800/60 rounded-lg p-2.5 font-mono text-xs text-green-400">
              Schedule by Zapier<br />
              ├─ Frequency: Every Week<br />
              ├─ Day of Week: {day}<br />
              └─ Time: {String(utcHour).padStart(2,'0')}:{String(minute).padStart(2,'0')} UTC
            </div>
            {!isDst && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertTriangle size={11} className="text-yellow-400" />
                <p className="text-yellow-500 text-xs">בשעון קיץ שנה את ה-UTC ל-{utcHour-1}:00</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-white text-xs font-semibold mb-1">Steps ({platforms.length} רשתות)</p>
            <div className="space-y-1.5">
              {platforms.map((p, i) => (
                <div key={p} className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-300 flex items-center justify-between">
                  <span className={p === 'tiktok' ? 'text-yellow-500' : ''}>{platformActions[p]}</span>
                  <span className="text-gray-600">Step {i + 2}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 bg-gray-800/40 rounded-lg p-2.5">
            <Info size={12} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <p className="text-gray-500 text-xs">
              TikTok API מוגבל לחשבונות Business עם גישה מיוחדת. מומלץ לפרסם שם ידנית בינתיים.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
