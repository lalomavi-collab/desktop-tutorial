import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ActivityItem, Platform } from '../types';
import { TwitterIcon, InstagramIcon, LinkedinIcon, FacebookIcon, TikTokIcon } from './SocialIcons';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const platformIcons: Record<Platform, React.ReactNode> = {
  twitter: <TwitterIcon size={12} className="text-sky-400" />,
  instagram: <InstagramIcon size={12} className="text-pink-400" />,
  linkedin: <LinkedinIcon size={12} className="text-blue-400" />,
  facebook: <FacebookIcon size={12} className="text-blue-600" />,
  tiktok: <TikTokIcon size={12} className="text-fuchsia-400" />,
};

const statusConfig = {
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-[#13151f] border border-gray-800 rounded-xl p-5">
      <h2 className="text-white font-semibold text-sm mb-4 flex items-center justify-between">
        פעילות אחרונה
        <span className="text-gray-600 font-normal text-xs">בזמן אמת</span>
      </h2>
      <div className="space-y-3">
        {activities.map((item) => {
          const { icon: StatusIcon, color, bg } = statusConfig[item.status];
          return (
            <div key={item.id} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <StatusIcon size={14} className={color} />
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600 text-xs flex-shrink-0">{item.timestamp}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.platform && (
                      <span className="flex-shrink-0">{platformIcons[item.platform]}</span>
                    )}
                    <span className="text-white text-xs font-medium truncate">{item.action}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
