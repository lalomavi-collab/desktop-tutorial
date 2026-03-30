import { Plus, Heart, Repeat2, MessageCircle, Clock, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import type { Post, Platform } from '../types';
import { TwitterIcon, InstagramIcon, LinkedinIcon, FacebookIcon, TikTokIcon, TelegramIcon } from './SocialIcons';

interface PostListProps {
  posts: Post[];
  onNewPost: () => void;
}

const platformIcons: Record<Platform, React.ReactNode> = {
  twitter: <TwitterIcon size={12} className="text-sky-400" />,
  instagram: <InstagramIcon size={12} className="text-pink-400" />,
  linkedin: <LinkedinIcon size={12} className="text-blue-400" />,
  facebook: <FacebookIcon size={12} className="text-blue-500" />,
  tiktok: <TikTokIcon size={12} className="text-fuchsia-400" />,
  telegram: <TelegramIcon size={12} className="text-sky-300" />,
};

const statusConfig = {
  published: { label: 'פורסם', color: 'text-green-400 bg-green-500/10', icon: CheckCircle2 },
  scheduled: { label: 'מתוזמן', color: 'text-orange-400 bg-orange-500/10', icon: Clock },
  draft: { label: 'טיוטה', color: 'text-gray-400 bg-gray-500/10', icon: FileText },
  failed: { label: 'נכשל', color: 'text-red-400 bg-red-500/10', icon: AlertCircle },
};

export function PostList({ posts, onNewPost }: PostListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={onNewPost}
          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg transition-all"
        >
          <Plus size={13} />
          פוסט חדש
        </button>
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">פוסטים אחרונים</h3>
      </div>

      {posts.map(post => {
        const { label, color, icon: StatusIcon } = statusConfig[post.status];
        return (
          <div key={post.id} className="bg-[#13151f] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                <StatusIcon size={11} />
                {label}
              </div>
              <div className="flex items-center gap-1.5">
                {post.platforms.map(p => (
                  <span key={p}>{platformIcons[p]}</span>
                ))}
              </div>
            </div>

            <p className="text-gray-300 text-sm text-right leading-relaxed mb-3">{post.content}</p>

            <div className="flex items-center justify-between">
              {post.status === 'published' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-gray-500">
                    <span className="text-xs">{post.comments}</span>
                    <MessageCircle size={12} />
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <span className="text-xs">{post.shares}</span>
                    <Repeat2 size={12} />
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <span className="text-xs">{post.likes}</span>
                    <Heart size={12} />
                  </div>
                </div>
              )}
              <div className="text-gray-600 text-xs mr-auto">
                {post.publishedAt ?? post.scheduledAt ?? '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
