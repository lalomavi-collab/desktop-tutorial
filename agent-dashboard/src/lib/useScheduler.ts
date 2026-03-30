import { useEffect, useRef, useCallback } from 'react';
import type { QueuedPost } from '../types';
import { sendToZapier, sendToTelegram } from './zapier';
import type { Platform } from '../types';

export interface SchedulerEvent {
  postId: string;
  topic: string;
  ok: boolean;
  sentAt: string;
}

interface UseSchedulerOptions {
  posts: QueuedPost[];
  onPostSent: (id: string, ok: boolean) => void;
  onEvent?: (event: SchedulerEvent) => void;
  /** Check interval in ms. Default: 30_000 (30 s) */
  intervalMs?: number;
}

/**
 * Polls every `intervalMs` and auto-sends approved posts whose
 * scheduledFor time has arrived (within a 5-minute window).
 */
export function useScheduler({
  posts,
  onPostSent,
  onEvent,
  intervalMs = 30_000,
}: UseSchedulerOptions) {
  // Keep a ref so the interval always sees the latest posts without re-registering
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const sentIds = useRef<Set<string>>(new Set());

  const sendPost = useCallback(async (post: QueuedPost) => {
    if (sentIds.current.has(post.id)) return;
    sentIds.current.add(post.id);

    const base = {
      schedule_mode: 'now' as const,
      agent: post.createdBy,
      timestamp: new Date().toISOString(),
      image_url: post.imageUrl,
    };

    const jobs = (post.platforms as Platform[]).map(async platform => {
      const content = post.platformOverrides?.[platform]?.trim() || post.content;
      if (platform === 'telegram') {
        return sendToTelegram({ ...base, content, platforms: [] });
      }
      return sendToZapier({ ...base, content, platforms: [platform] });
    });

    const results = await Promise.all(jobs);
    const ok = results.every(r => r.ok);
    onPostSent(post.id, ok);
    onEvent?.({ postId: post.id, topic: post.topic, ok, sentAt: new Date().toISOString() });
  }, [onPostSent, onEvent]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const post of postsRef.current) {
        if (post.status !== 'approved') continue;
        if (!post.scheduledFor) continue;
        const scheduled = new Date(post.scheduledFor).getTime();
        const diff = now - scheduled;
        // Send if within the 5-minute dispatch window (0–300 s past scheduled time)
        if (diff >= 0 && diff <= 300_000) {
          sendPost(post);
        }
      }
    };

    tick(); // run immediately on mount
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [sendPost, intervalMs]);
}

/** Returns ms until the next Saturday 19:00 Israel time (approximated as UTC+3) */
export function msUntilNextSat19(): number {
  const now = new Date();
  // Work in UTC+3 (Israel summer)
  const offsetMs = 3 * 60 * 60 * 1000;
  const ilNow = new Date(now.getTime() + offsetMs);

  const day = ilNow.getUTCDay();     // 0=Sun … 6=Sat
  const hour = ilNow.getUTCHours();
  const min  = ilNow.getUTCMinutes();
  const sec  = ilNow.getUTCSeconds();

  let daysUntil = (6 - day + 7) % 7;
  if (daysUntil === 0 && (hour > 19 || (hour === 19 && (min > 0 || sec > 0)))) {
    daysUntil = 7;
  }

  const secsFromMidnight = hour * 3600 + min * 60 + sec;
  const target = 19 * 3600; // 19:00

  let totalSec = daysUntil * 86400 + (target - secsFromMidnight);
  if (totalSec < 0) totalSec += 7 * 86400;
  return totalSec * 1000;
}

/** Format a duration in ms as "X ימים Yש Zm" */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);

  if (days > 0)  return `${days} ימים ${hours}:${String(mins).padStart(2, '0')}ש`;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')} שעות`;
  return `${mins} דקות`;
}
