export type AgentStatus = 'active' | 'idle' | 'paused' | 'error';

export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok' | 'telegram';

export interface PlatformConnection {
  platform: Platform;
  connected: boolean;
  username?: string;
  followers?: number;
  lastSync?: string;
}

/** A platform sub-agent managed by the Social Media Manager */
export interface PlatformAgent {
  platform: Platform;
  status: AgentStatus;
  connection: PlatformConnection;
  postsToday: number;
  postsTotal: number;
  lastPost?: string;
  scheduledPosts: number;
}

export interface AgentMetrics {
  successRate: number;      // 0–100
  uptime: number;           // 0–100
  avgTaskDuration: string;  // e.g. "2.4 דק'"
  tasksThisWeek: number;
  tokensUsed?: number;
  costThisMonth?: number;   // USD
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  description: string;
  role?: string;            // short role label (e.g. "מנכ\"ל")
  parent?: string;          // parent agent id (for hierarchy)
  tasksCompleted: number;
  tasksRunning: number;
  tasksQueue?: number;
  connections?: PlatformConnection[];
  /** Sub-agents, used by the social media manager */
  platformAgents?: PlatformAgent[];
  lastActive: string;
  metrics?: AgentMetrics;
  skills?: string[];
  color?: string;           // accent color class e.g. 'purple'
}

export interface Post {
  id: string;
  content: string;
  platforms: Platform[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  likes?: number;
  shares?: number;
  comments?: number;
  imageUrl?: string;
}

export interface ScheduledTime {
  id: string;
  dayOfWeek: number; // 0=Sun, 6=Sat
  hour: number;
  minute: number;
  active: boolean;
  label?: string;
}

export type ContentStyle = 'professional' | 'casual' | 'news' | 'promotional' | 'educational' | 'inspirational';
export type EmojiStyle = 'none' | 'minimal' | 'rich';
export type HashtagStyle = 'none' | 'few' | 'many';

export interface PlatformAgentConfig {
  platform: Platform;
  webhookUrl?: string;
  contentStyle: ContentStyle;
  scheduledTimes: ScheduledTime[];
  autoPost: boolean;
  postTemplate?: string;
  emojiStyle: EmojiStyle;
  hashtagStyle: HashtagStyle;
  maxPostsPerDay: number;
}

export interface QueuedPost {
  id: string;
  topic: string;
  content: string;
  platforms: Platform[];
  platformOverrides?: Partial<Record<Platform, string>>;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed';
  createdAt: string;
  scheduledFor?: string;
  sentAt?: string;
  createdBy: string;
}

export interface ActivityItem {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  detail: string;
  timestamp: string;
  platform?: Platform;
  status: 'success' | 'error' | 'info';
}
