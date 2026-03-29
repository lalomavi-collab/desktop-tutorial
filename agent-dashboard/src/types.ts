export type AgentStatus = 'active' | 'idle' | 'paused' | 'error';

export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok';

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

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  description: string;
  tasksCompleted: number;
  tasksRunning: number;
  connections?: PlatformConnection[];
  /** Sub-agents, used by the social media manager */
  platformAgents?: PlatformAgent[];
  lastActive: string;
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
