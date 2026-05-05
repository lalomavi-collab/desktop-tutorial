import { useState, useEffect } from 'react';
import { Mail, AlertTriangle, RefreshCw, Tag, Newspaper, Megaphone, Cpu, CheckCircle, Circle, Users } from 'lucide-react';

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  timestamp: string;
  category: 'alerts' | 'linkedin' | 'tech' | 'newsletters' | 'promotions';
  read: boolean;
  urgent: boolean;
}

interface EmailData {
  fetchedAt: string;
  account: string;
  totalCount: number;
  unreadCount: number;
  emails: Email[];
}

type CategoryFilter = 'all' | 'alerts' | 'linkedin' | 'tech' | 'newsletters' | 'promotions';

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  alerts:      { label: 'התראות',    icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  linkedin:    { label: 'לינקדין',   icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  tech:        { label: 'טכנולוגיה', icon: Cpu,           color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  newsletters: { label: 'ניוזלטרים', icon: Newspaper,     color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/30' },
  promotions:  { label: 'קידום',     icon: Megaphone,     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return `לפני ${Math.max(1, Math.floor(diffMs / 60_000))} דקות`;
  if (diffH < 24) return `לפני ${diffH} שעות`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function SenderAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['from-blue-500 to-blue-700', 'from-purple-500 to-purple-700', 'from-emerald-500 to-emerald-700',
                  'from-orange-500 to-orange-700', 'from-pink-500 to-pink-700', 'from-teal-500 to-teal-700'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export function EmailDashboard() {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [readEmails, setReadEmails] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL ?? '/';
      const res = await fetch(`${base}email-daily.json?t=${Date.now()}`);
      const json: EmailData = await res.json();
      setData(json);
      const alreadyRead = new Set(json.emails.filter(e => e.read).map(e => e.id));
      setReadEmails(alreadyRead);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => { loadData(); }, []);

  const markRead = (id: string) => setReadEmails(prev => new Set([...prev, id]));

  const allEmails = data?.emails ?? [];
  const filtered = filter === 'all' ? allEmails : allEmails.filter(e => e.category === filter);
  const urgentCount = allEmails.filter(e => e.urgent).length;
  const unreadCount = allEmails.filter(e => !readEmails.has(e.id)).length;

  const categoryCounts = Object.fromEntries(
    Object.keys(CATEGORY_META).map(cat => [cat, allEmails.filter(e => e.category === cat).length])
  );

  const tabs: { id: CategoryFilter; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'all',         label: 'הכל',       icon: Mail,        count: allEmails.length },
    { id: 'alerts',      label: 'התראות',    icon: AlertTriangle, count: categoryCounts.alerts },
    { id: 'linkedin',    label: 'לינקדין',   icon: Users,       count: categoryCounts.linkedin },
    { id: 'tech',        label: 'טכנולוגיה', icon: Cpu,         count: categoryCounts.tech },
    { id: 'newsletters', label: 'ניוזלטרים', icon: Newspaper,   count: categoryCounts.newsletters },
    { id: 'promotions',  label: 'קידום',     icon: Megaphone,   count: categoryCounts.promotions },
  ];

  return (
    <div className="text-right" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          רענן
        </button>
        <div>
          <h1 className="text-white font-bold text-2xl">דשבורד מיילים</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.account} · עודכן {formatTime(lastRefresh.toISOString())}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'סה"כ מיילים', value: allEmails.length, color: 'text-white', icon: Mail },
          { label: 'לא נקראו', value: unreadCount, color: 'text-blue-400', icon: Circle },
          { label: 'דחופים', value: urgentCount, color: 'text-red-400', icon: AlertTriangle },
          { label: 'קטגוריות', value: Object.keys(CATEGORY_META).length, color: 'text-purple-400', icon: Tag },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#13151f] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon size={16} className={color} />
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
            </div>
            <p className="text-gray-500 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Urgent alerts banner */}
      {allEmails.some(e => e.urgent && !readEmails.has(e.id)) && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-400" />
            <span className="text-red-400 font-semibold text-sm">פעולה נדרשת</span>
          </div>
          <div className="space-y-2">
            {allEmails.filter(e => e.urgent && !readEmails.has(e.id)).map(e => (
              <div key={e.id} className="flex items-start gap-3 bg-red-500/5 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{e.subject}</p>
                  <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{e.preview}</p>
                </div>
                <span className="text-gray-500 text-xs whitespace-nowrap">{formatTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filter === id
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 border border-transparent'
            }`}
          >
            <Icon size={12} />
            {label}
            {count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === id ? 'bg-purple-500/30 text-purple-300' : 'bg-gray-700 text-gray-400'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Email list */}
      <div className="bg-[#13151f] border border-gray-800 rounded-xl overflow-hidden">
        {loading && allEmails.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw size={24} className="animate-spin text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">טוען מיילים...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Mail size={24} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">אין מיילים בקטגוריה זו</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filtered.map((email) => {
              const isRead = readEmails.has(email.id);
              const catMeta = CATEGORY_META[email.category];
              const CatIcon = catMeta.icon;
              return (
                <div
                  key={email.id}
                  onClick={() => markRead(email.id)}
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-800/40 ${isRead ? 'opacity-60' : ''}`}
                >
                  <SenderAvatar name={email.from} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-medium text-sm ${isRead ? 'text-gray-400' : 'text-white'}`}>
                        {email.from}
                      </span>
                      {email.urgent && !isRead && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                          דחוף
                        </span>
                      )}
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${catMeta.bg} ${catMeta.color} mr-auto`}>
                        <CatIcon size={10} />
                        {catMeta.label}
                      </span>
                    </div>
                    <p className={`text-sm mb-1 truncate ${isRead ? 'text-gray-500' : 'text-gray-200'}`}>
                      {email.subject}
                    </p>
                    <p className="text-gray-600 text-xs truncate">{email.preview}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-gray-600 text-xs whitespace-nowrap">{formatTime(email.timestamp)}</span>
                    {isRead
                      ? <CheckCircle size={13} className="text-gray-700" />
                      : <div className="w-2 h-2 rounded-full bg-blue-500" />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-gray-700 text-xs mt-4">
          מציג {filtered.length} מיילים · {data?.account}
        </p>
      )}
    </div>
  );
}
