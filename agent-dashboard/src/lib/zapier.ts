import type { Platform } from '../types';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/';

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

export async function sendToZapier(
  payload: ZapierPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/** Helper: build a Motzei Shabbat payload */
export function buildMotzeiShabbatPayload(
  content: string,
  platforms: Platform[],
  imageUrl?: string
): ZapierPayload {
  const now = new Date();
  // Israel is UTC+3 summer / UTC+2 winter
  const isDst = now.getMonth() >= 2 && now.getMonth() <= 9;
  const utcHour = isDst ? 16 : 17; // 19:00 Israel → 16 or 17 UTC

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
