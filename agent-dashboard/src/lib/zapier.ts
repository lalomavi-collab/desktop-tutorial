import type { Platform } from '../types';

/**
 * Per-platform Zapier webhook endpoints.
 * Each platform has its own Zap that receives the payload and publishes.
 */
export const PLATFORM_WEBHOOKS: Partial<Record<Platform, string>> = {
  // LinkedIn Posts to Business Account
  linkedin: 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/',
  // Facebook Posts to Facebook Page  (URL TBD — add when ready)
  facebook: 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/',
  // Twitter — same hub for now (add dedicated URL when ready)
  twitter: 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/',
  // Instagram — same hub for now
  instagram: 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/',
};

/**
 * Telegram webhook — sends to Telegram Bot
 */
export const TELEGRAM_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/26446500/unrrbau/';

/** Fallback / broadcast webhook */
const BROADCAST_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/';

export interface ZapierPayload {
  content: string;
  platforms: Platform[];
  schedule_mode: 'now' | 'scheduled' | 'motzei_shabbat';
  scheduled_at?: string;
  /** Israel time: e.g. "Saturday 19:00 Asia/Jerusalem" */
  israel_time?: string;
  /** UTC equivalent for Zapier scheduler */
  utc_time?: string;
  image_url?: string;
  agent: string;
  timestamp: string;
}

interface SendResult {
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

/**
 * Send to each platform's individual webhook in parallel.
 * Falls back to the broadcast webhook for platforms without a dedicated URL.
 */
export async function sendToZapier(
  payload: ZapierPayload
): Promise<{ ok: boolean; error?: string }> {
  const targets = payload.platforms.map(platform => {
    const url = PLATFORM_WEBHOOKS[platform] ?? BROADCAST_WEBHOOK;
    return postWebhook(url, { ...payload, platforms: [platform] });
  });

  const results = await Promise.all(targets);
  const failed = results.find(r => !r.ok);
  return failed ?? { ok: true };
}

/**
 * Send to Telegram bot webhook.
 */
export async function sendToTelegram(
  payload: ZapierPayload
): Promise<SendResult> {
  const result = await postWebhook(TELEGRAM_WEBHOOK, { ...payload, platforms: [] });
  return { ...result, platform: 'telegram' };
}

/**
 * Send to ALL channels: each platform webhook + Telegram.
 */
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

/** Helper: build a Motzei Shabbat payload */
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
