import type { Platform } from '../types';

/**
 * Per-platform Zapier webhook endpoints — verified & active
 */
export const PLATFORM_WEBHOOKS: Partial<Record<Platform, string>> = {
  linkedin:  'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/',
  facebook:  'https://hooks.zapier.com/hooks/catch/26446500/uniufh3/',
  twitter:   'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/', // TBD — dedicated URL
  instagram: 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/', // TBD — dedicated URL
};

export const TELEGRAM_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/26446500/unrrbau/';

const BROADCAST_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/';

export interface ZapierPayload {
  content: string;
  platforms: Platform[];
  schedule_mode: 'now' | 'scheduled' | 'motzei_shabbat';
  scheduled_at?: string;
  israel_time?: string;
  utc_time?: string;
  image_url?: string;
  agent: string;
  timestamp: string;
}

export interface SendResult {
  ok: boolean;
  platform?: Platform | 'telegram' | 'broadcast';
  error?: string;
}

async function postWebhook(
  url: string,
  payload: ZapierPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendToZapier(
  payload: ZapierPayload
): Promise<{ ok: boolean; error?: string }> {
  const targets = payload.platforms.map(platform => {
    const url = PLATFORM_WEBHOOKS[platform] ?? BROADCAST_WEBHOOK;
    return postWebhook(url, { ...payload, platforms: [platform] });
  });
  const results = await Promise.all(targets);
  return results.find(r => !r.ok) ?? { ok: true };
}

export async function sendToTelegram(
  payload: ZapierPayload
): Promise<SendResult> {
  const result = await postWebhook(TELEGRAM_WEBHOOK, { ...payload, platforms: [] });
  return { ...result, platform: 'telegram' };
}

export async function broadcastAll(
  payload: ZapierPayload
): Promise<SendResult[]> {
  const platformResults = payload.platforms.map(async platform => {
    const url = PLATFORM_WEBHOOKS[platform] ?? BROADCAST_WEBHOOK;
    const r = await postWebhook(url, { ...payload, platforms: [platform] });
    return { ...r, platform } as SendResult;
  });
  const telegramResult = sendToTelegram(payload);
  return Promise.all([...platformResults, telegramResult]);
}

export function buildMotzeiShabbatPayload(
  content: string,
  platforms: Platform[],
  imageUrl?: string
): ZapierPayload {
  const now = new Date();
  const isDst = now.getMonth() >= 2 && now.getMonth() <= 9;
  const utcHour = isDst ? 16 : 17;
  return {
    content,
    platforms,
    schedule_mode: 'motzei_shabbat',
    israel_time: 'Saturday 19:00 Asia/Jerusalem',
    utc_time: `Saturday ${String(utcHour).padStart(2, '0')}:00 UTC`,
    image_url: imageUrl,
    agent: 'עידית — מנהלת השיווק',
    timestamp: new Date().toISOString(),
  };
}
