import { useState } from 'react';
import {
  Plus, Trash2, Clock, CheckCircle2, FileText,
  AlertCircle, Send, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { Platform } from '../types';
import { platformMeta } from './PlatformAgentCard';

export interface MotzeiShabbatPost {
  id: string;
  date: string;       // YYYY-MM-DD (the Saturday)
  content: string;
  imageUrl?: string;
  platforms: Platform[];
  status: 'draft' | 'ready' | 'sent' | 'failed';
}

interface ContentCalendarProps {
  posts: MotzeiShabbatPost[];
  onUpdate: (posts: MotzeiShabbatPost[]) => void;
  onSendNow: (post: MotzeiShabbatPost) => void;
}

function nextSaturdays(count = 6): string[] {
  const saturdays: string[] = [];
  const d = new Date();
  // advance to next Saturday
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < count; i++) {
    saturdays.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return saturdays;
}

function hebrewDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

const STATUS_CONFIG = {
  draft:  { label: 'טיוטה',  color: 'text-gray-400 bg-gray-700/50',           icon: FileText },
  ready:  { label: 'מוכן',   color: 'text-green-400 bg-green-500/10',          icon: CheckCircle2 },
  sent:   { label: 'נשלח',   color: 'text-blue-400 bg-blue-500/10',            icon: Send },
  failed: { label: 'נכשל',   color: 'text-red-400 bg-red-500/10',              icon: AlertCircle },
};

const ALL_PLATFORMS: Platform[] = ['twitter', 'instagram', 'linkedin', 'facebook'];

export function ContentCalendar({ posts, onUpdate, onSendNow }: ContentCalendarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pageOffset, setPageOffset] = useState(0);

  const saturdays = nextSaturdays(12);
  const visible = saturdays.slice(pageOffset, pageOffset + 6);

  const getPost = (date: string) => posts.find(p => p.date === date);

  const addPost = (date: string) => {
    const newPost: MotzeiShabbatPost = {
      id: `msh-${date}`,
      date,
      content: '',
      platforms: ALL_PLATFORMS,
      status: 'draft',
    };
    onUpdate([...posts, newPost]);
    setEditingId(newPost.id);
  };

  const updatePost = (id: string, changes: Partial<MotzeiShabbatPost>) => {
    onUpdate(posts.map(p => p.id === id ? { ...p, ...changes } : p));
  };

  const deletePost = (id: string) => {
    onUpdate(posts.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const markReady = (id: string) => {
    updatePost(id, { status: 'ready' });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPageOffset(o => Math.min(o + 6, 6))}
          disabled={pageOffset >= 6}
          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-purple-400" />
          <span className="text-white text-sm font-semibold">מוצאי שבת — לוח תוכן</span>
        </div>
        <button
          onClick={() => setPageOffset(o => Math.max(o - 6, 0))}
          disabled={pageOffset === 0}
          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Weeks */}
      <div className="space-y-3">
        {visible.map(date => {
          const post = getPost(date);
          const isEditing = post && editingId === post.id;

          return (
            <div
              key={date}
              className={`bg-[#13151f] border rounded-xl overflow-hidden transition-all ${
                post?.status === 'ready' ? 'border-green-500/30'
                : post?.status === 'sent'  ? 'border-blue-500/20'
                : post              ? 'border-purple-500/20'
                : 'border-gray-800'
              }`}
            >
              {/* Date header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
                <div className="flex items-center gap-2">
                  {post && (
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[post.status].color}`}>
                      {(() => { const I = STATUS_CONFIG[post.status].icon; return <I size={11} />; })()}
                      {STATUS_CONFIG[post.status].label}
                    </div>
                  )}
                  {!post && (
                    <button
                      onClick={() => addPost(date)}
                      className="flex items-center gap-1 text-gray-600 hover:text-purple-400 text-xs transition-colors"
                    >
                      <Plus size={12} /> הוסף פוסט
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-white text-sm font-semibold">מוצ"ש {hebrewDate(date)}</span>
                    <div className="flex items-center gap-1 text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      <Clock size={10} />
                      <span className="text-xs font-medium">19:00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Post content */}
              {post && (
                <div className="p-4">
                  <div className="flex gap-1 mb-3 border-b border-gray-800 pb-2">
                    <button
                      onClick={() => setEditingId(post.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        isEditing ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      כתיבה
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        !isEditing ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      תצוגה מקדימה
                    </button>
                  </div>
                  {isEditing ? (
                    <PostEditor
                      post={post}
                      onChange={changes => updatePost(post.id, changes)}
                      onMarkReady={() => markReady(post.id)}
                      onDelete={() => deletePost(post.id)}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <PostPreview
                      post={post}
                      onSendNow={() => onSendNow(post)}
                      onDelete={() => deletePost(post.id)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PostEditorProps {
  post: MotzeiShabbatPost;
  onChange: (c: Partial<MotzeiShabbatPost>) => void;
  onMarkReady: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function PostEditor({ post, onChange, onMarkReady, onDelete, onClose }: PostEditorProps) {
  const togglePlatform = (p: Platform) => {
    onChange({
      platforms: post.platforms.includes(p)
        ? post.platforms.filter(x => x !== p)
        : [...post.platforms, p],
    });
  };

  return (
    <div className="space-y-3">
      {/* Platform selector */}
      <div className="flex flex-wrap gap-1.5 justify-end">
        {ALL_PLATFORMS.map(p => {
          const meta = platformMeta[p];
          const selected = post.platforms.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                selected ? `${meta.bg} ${meta.textColor} ${meta.border}` : 'text-gray-600 border-gray-700'
              }`}
            >
              {meta.icon}
              {meta.label.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Textarea */}
      <textarea
        value={post.content}
        onChange={e => onChange({ content: e.target.value })}
        placeholder="כתוב את פוסט מוצ&quot;ש..."
        rows={4}
        dir="rtl"
        className="w-full bg-gray-800/60 border border-gray-700 text-white text-sm rounded-xl p-3 resize-none outline-none focus:border-purple-500 placeholder-gray-600 leading-relaxed"
      />

      {/* Image URL */}
      <input
        type="url"
        value={post.imageUrl ?? ''}
        onChange={e => onChange({ imageUrl: e.target.value })}
        placeholder="קישור לתמונה (נדרש עבור Instagram)"
        dir="ltr"
        className="w-full bg-gray-800/60 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-purple-500 placeholder-gray-600"
      />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700 transition-all"
          >
            ביטול
          </button>
        </div>
        <button
          onClick={onMarkReady}
          disabled={!post.content.trim()}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all"
        >
          <CheckCircle2 size={13} />
          סמן כמוכן
        </button>
      </div>
    </div>
  );
}

interface PostPreviewProps {
  post: MotzeiShabbatPost;
  onSendNow: () => void;
  onDelete: () => void;
}

function PostPreview({ post, onSendNow, onDelete }: PostPreviewProps) {
  return (
    <div>
      <p className="text-gray-300 text-sm text-right leading-relaxed mb-3 line-clamp-3">
        {post.content || <span className="text-gray-600 italic">אין תוכן עדיין</span>}
      </p>

      {/* Platforms row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.status !== 'sent' && (
            <>
              {post.status === 'ready' && (
                <button
                  onClick={onSendNow}
                  className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-all font-medium"
                >
                  <Send size={11} />
                  שלח עכשיו
                </button>
              )}
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {post.platforms.map(p => {
            const meta = platformMeta[p];
            return (
              <span key={p} className={`${meta.textColor}`}>{meta.icon}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
