import { useState } from 'react';
import {
  CheckCircle2, XCircle, Send, Clock, Zap, Plus, Loader2,
  AlertCircle, ChevronDown, ChevronUp, Sparkles, Eye, EyeOff,
  Calendar, RefreshCw, Trash2,
} from 'lucide-react';
import type { Platform, QueuedPost } from '../types';
import { platformMeta } from './PlatformAgentCard';
import { sendToZapier, sendToTelegram } from '../lib/zapier';

interface PostApprovalQueueProps {
  posts: QueuedPost[];
  onUpdate: (posts: QueuedPost[]) => void;
  connectedPlatforms: Platform[];
}

/* ── Seed test post: Law & AI ─────────────────────────────────── */
export const SEED_POSTS: QueuedPost[] = [
  {
    id: 'q-law-ai-001',
    topic: 'משפט ו-AI',
    content:
      '📚 בינה מלאכותית ומשפט — המהפכה כבר כאן\n\n' +
      'AI משנה את עולם המשפט לבלי הכר:\n' +
      '✅ ניתוח חוזים תוך שניות\n' +
      '✅ חיזוי פסקי דין על בסיס פסיקה היסטורית\n' +
      '✅ סיוע לעורכי דין בחקר משפטי מעמיק\n\n' +
      'האם AI יחליף עורכי דין? 🤔\n' +
      'לא — אבל עורך דין שמשתמש ב-AI ייקח את מקומו של מי שלא.\n\n' +
      '#AI #משפט #בינהמלאכותית #עתיד_המקצועות',
    platformOverrides: {
      linkedin:
        'AI & Law: The Legal Revolution Is Here 🏛️\n\n' +
        'Artificial Intelligence is fundamentally reshaping the legal profession:\n' +
        '✅ Contract analysis in seconds\n' +
        '✅ Case outcome prediction based on historical precedents\n' +
        '✅ Automated legal research at scale\n\n' +
        "The question isn't whether AI will impact law —\n" +
        "it's whether legal professionals will lead this transformation or follow it.\n\n" +
        'The future belongs to those who adapt. ⚖️\n\n' +
        '#AI #LegalTech #ArtificialIntelligence #FutureOfWork #Law',
    },
    platforms: ['telegram', 'linkedin', 'facebook'],
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: 'עידית — מנהלת השיווק',
  },
];

/* ── Status display helpers ────────────────────────────────────── */
const STATUS_META: Record<QueuedPost['status'], { label: string; color: string; dot: string }> = {
  pending:  { label: 'ממתין לאישור', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500 animate-pulse' },
  approved: { label: 'מאושר',        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',     dot: 'bg-blue-500' },
  rejected: { label: 'נדחה',         color: 'text-red-400 bg-red-500/10 border-red-500/20',        dot: 'bg-red-500' },
  sent:     { label: 'נשלח ✓',       color: 'text-green-400 bg-green-500/10 border-green-500/20',  dot: 'bg-green-500' },
  failed:   { label: 'נכשל',         color: 'text-red-500 bg-red-600/10 border-red-600/20',        dot: 'bg-red-600' },
};

/* ── New post form ─────────────────────────────────────────────── */
interface NewPostFormProps {
  connectedPlatforms: Platform[];
  onAdd: (post: QueuedPost) => void;
  onCancel: () => void;
}

function NewPostForm({ connectedPlatforms, onAdd, onCancel }: NewPostFormProps) {
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(connectedPlatforms);
  const [scheduledFor, setScheduledFor] = useState('');
  const [schedTime, setSchedTime] = useState('19:00');
  const [linkedinEn, setLinkedinEn] = useState('');

  const togglePlatform = (p: Platform) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleAdd = () => {
    if (!content.trim()) return;
    const overrides: Partial<Record<Platform, string>> = {};
    if (linkedinEn.trim()) overrides.linkedin = linkedinEn;
    onAdd({
      id: `q-${Date.now()}`,
      topic: topic || 'פוסט חדש',
      content,
      platforms: selectedPlatforms,
      platformOverrides: Object.keys(overrides).length ? overrides : undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
      scheduledFor: scheduledFor ? `${scheduledFor}T${schedTime}:00` : undefined,
      createdBy: 'עידית — מנהלת השיווק',
    });
  };

  return (
    <div className="bg-[#13151f] border border-purple-500/20 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-white font-semibold text-sm">פוסט חדש לתור האישורים</h3>
        <Sparkles size={15} className="text-purple-400" />
      </div>

      {/* Topic */}
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="נושא הפוסט (לדוגמה: AI ומשפט)"
        dir="rtl"
        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600"
      />

      {/* Main content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="תוכן הפוסט (עברית — לכל הרשתות)"
        rows={5}
        dir="rtl"
        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-purple-500 placeholder-gray-600 resize-none"
      />

      {/* LinkedIn English override */}
      {selectedPlatforms.includes('linkedin') && (
        <textarea
          value={linkedinEn}
          onChange={e => setLinkedinEn(e.target.value)}
          placeholder="LinkedIn — English version (optional)"
          rows={3}
          dir="ltr"
          className="w-full bg-gray-800 border border-blue-500/30 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-600 resize-none"
        />
      )}

      {/* Platform selector */}
      <div className="flex gap-2 flex-wrap justify-end">
        {connectedPlatforms.map(p => {
          const meta = platformMeta[p];
          const sel = selectedPlatforms.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                sel ? `${meta.bg} ${meta.textColor} ${meta.border}` : 'border-gray-700 text-gray-500'
              }`}
            >
              {meta.icon}{meta.label}
            </button>
          );
        })}
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-2 justify-end">
        <input
          type="time"
          value={schedTime}
          onChange={e => setSchedTime(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
        />
        <input
          type="date"
          value={scheduledFor}
          onChange={e => setScheduledFor(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
        />
        <span className="text-gray-500 text-xs">תזמן לתאריך (אופציונלי)</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">
          ביטול
        </button>
        <button
          onClick={handleAdd}
          disabled={!content.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-all"
        >
          <Plus size={14} />
          הוסף לתור
        </button>
      </div>
    </div>
  );
}

/* ── Single post card ──────────────────────────────────────────── */
interface PostCardProps {
  post: QueuedPost;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSend: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  sending: string | null;
}

function PostCard({ post, onApprove, onReject, onSend, onDelete, sending }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sm = STATUS_META[post.status];
  const isSending = sending === post.id;

  return (
    <div className={`bg-[#13151f] border rounded-xl overflow-hidden transition-all ${
      post.status === 'sent' ? 'border-green-500/20' :
      post.status === 'pending' ? 'border-yellow-500/20' :
      post.status === 'rejected' ? 'border-gray-800' :
      'border-gray-800'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${sm.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
            {sm.label}
          </div>

          {/* Topic + meta */}
          <div className="text-right flex-1">
            <div className="flex items-center gap-2 justify-end">
              <h4 className="text-white font-semibold text-sm">{post.topic}</h4>
              <Sparkles size={13} className="text-purple-400" />
            </div>
            <p className="text-gray-600 text-xs mt-0.5">
              {post.createdBy} · {new Date(post.createdAt).toLocaleDateString('he-IL')}
              {post.scheduledFor && (
                <span className="text-orange-400 mr-2">
                  · 🕐 {new Date(post.scheduledFor).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Platforms */}
        <div className="flex gap-1.5 mt-3 justify-end">
          {post.platforms.map(p => {
            const meta = platformMeta[p];
            return (
              <span key={p} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${meta.bg} ${meta.textColor}`}>
                {meta.icon}{meta.label.split(' ')[0]}
                {post.platformOverrides?.[p] && <span className="opacity-60 text-xs ml-0.5">EN</span>}
              </span>
            );
          })}
        </div>

        {/* Content preview */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full text-right mt-3 text-gray-400 text-xs hover:text-gray-200 transition-colors flex items-center gap-1 justify-end"
        >
          {expanded ? <EyeOff size={11} /> : <Eye size={11} />}
          {expanded ? 'הסתר תוכן' : 'הצג תוכן'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            <div className="bg-gray-800/50 rounded-lg p-3 text-gray-300 text-xs whitespace-pre-wrap text-right leading-relaxed">
              {post.content}
            </div>
            {post.platformOverrides?.linkedin && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                <p className="text-blue-400 text-xs mb-1 text-right">LinkedIn (English):</p>
                <p className="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed">
                  {post.platformOverrides.linkedin}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {(post.status === 'pending' || post.status === 'approved') && (
        <div className="border-t border-gray-800 p-3 flex gap-2">
          {post.status === 'pending' && (
            <>
              <button
                onClick={() => onReject(post.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-red-400 bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 transition-all"
              >
                <XCircle size={13} /> דחה
              </button>
              <button
                onClick={() => onApprove(post.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-all"
              >
                <CheckCircle2 size={13} /> אשר
              </button>
            </>
          )}

          {post.status === 'approved' && (
            <>
              <button
                onClick={() => onReject(post.id)}
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 bg-gray-800 transition-all"
              >
                <XCircle size={13} />
              </button>
              <button
                onClick={() => onSend(post.id)}
                disabled={isSending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 transition-all"
              >
                {isSending
                  ? <><Loader2 size={14} className="animate-spin" /> שולח...</>
                  : <><Zap size={14} /> שלח עכשיו דרך Zapier</>
                }
              </button>
            </>
          )}
        </div>
      )}

      {/* Sent / failed footer */}
      {post.status === 'sent' && (
        <div className="border-t border-green-500/10 px-4 py-2 flex items-center justify-between">
          <span className="text-gray-600 text-xs">
            {post.sentAt ? new Date(post.sentAt).toLocaleString('he-IL') : ''}
          </span>
          <div className="flex items-center gap-1.5 text-green-400 text-xs">
            <CheckCircle2 size={12} />
            נשלח בהצלחה
          </div>
        </div>
      )}

      {post.status === 'failed' && (
        <div className="border-t border-red-500/10 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => onApprove(post.id)}
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            <RefreshCw size={11} /> נסה שוב
          </button>
          <div className="flex items-center gap-1.5 text-red-400 text-xs">
            <AlertCircle size={12} />
            שליחה נכשלה
          </div>
        </div>
      )}

      {post.status === 'rejected' && (
        <div className="border-t border-gray-800 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => onDelete(post.id)}
            className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1"
          >
            <Trash2 size={11} /> מחק
          </button>
          <span className="text-gray-600 text-xs">נדחה</span>
        </div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */
export function PostApprovalQueue({ posts, onUpdate, connectedPlatforms }: PostApprovalQueueProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | QueuedPost['status']>('all');

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  const counts = {
    pending:  posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    sent:     posts.filter(p => p.status === 'sent').length,
  };

  const updatePost = (id: string, patch: Partial<QueuedPost>) =>
    onUpdate(posts.map(p => p.id === id ? { ...p, ...patch } : p));

  const handleApprove = (id: string) => updatePost(id, { status: 'approved' });
  const handleReject  = (id: string) => updatePost(id, { status: 'rejected' });
  const handleDelete  = (id: string) => onUpdate(posts.filter(p => p.id !== id));

  const handleSend = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    setSending(id);

    const base = {
      schedule_mode: 'now' as const,
      agent: post.createdBy,
      timestamp: new Date().toISOString(),
      image_url: post.imageUrl,
    };

    // Send each platform individually to respect overrides
    const jobs = post.platforms.map(async platform => {
      const content = post.platformOverrides?.[platform]?.trim() || post.content;
      if (platform === 'telegram') {
        return sendToTelegram({ ...base, content, platforms: [] });
      }
      return sendToZapier({ ...base, content, platforms: [platform] });
    });

    const results = await Promise.all(jobs);
    const allOk = results.every(r => r.ok);
    setSending(null);
    updatePost(id, {
      status: allOk ? 'sent' : 'failed',
      sentAt: allOk ? new Date().toISOString() : undefined,
    });
  };

  const handleAddPost = (post: QueuedPost) => {
    onUpdate([post, ...posts]);
    setShowNewForm(false);
  };

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending',  label: 'ממתין',   color: 'text-yellow-400', icon: Clock },
          { key: 'approved', label: 'מאושר',   color: 'text-blue-400',   icon: CheckCircle2 },
          { key: 'sent',     label: 'נשלח',    color: 'text-green-400',  icon: Send },
        ].map(({ key, label, color, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(prev => prev === key ? 'all' : key as QueuedPost['status'])}
            className={`bg-[#13151f] border rounded-xl p-3 text-right transition-all hover:border-gray-600 ${
              filter === key ? 'border-gray-500' : 'border-gray-800'
            }`}
          >
            <Icon size={14} className={`${color} mb-1`} />
            <p className={`font-bold text-lg ${color}`}>{counts[key as keyof typeof counts]}</p>
            <p className="text-gray-600 text-xs">{label}</p>
          </button>
        ))}
      </div>

      {/* Add new post button */}
      {!showNewForm && (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 text-sm transition-all"
        >
          <Plus size={15} />
          הוסף פוסט לתור האישורים
        </button>
      )}

      {showNewForm && (
        <NewPostForm
          connectedPlatforms={connectedPlatforms}
          onAdd={handleAddPost}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Schedule info */}
      {posts.some(p => p.scheduledFor && p.status === 'approved') && (
        <div className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/15 rounded-xl p-3 justify-end">
          <p className="text-orange-300 text-xs">
            {posts.filter(p => p.scheduledFor && p.status === 'approved').length} פוסטים מאושרים ומתוזמנים
          </p>
          <Calendar size={13} className="text-orange-400" />
        </div>
      )}

      {/* Post list */}
      {filtered.length === 0 ? (
        <div className="bg-[#13151f] border border-gray-800 rounded-xl p-10 text-center">
          <Sparkles size={28} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">
            {filter === 'all' ? 'אין פוסטים בתור — לחץ + להוסיף' : `אין פוסטים בסטטוס "${STATUS_META[filter].label}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onApprove={handleApprove}
              onReject={handleReject}
              onSend={handleSend}
              onDelete={handleDelete}
              sending={sending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
