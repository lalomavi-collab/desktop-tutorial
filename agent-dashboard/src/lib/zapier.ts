import type { Platform } from '../types';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26446500/unr1xen/';

export interface ZapierPayload {
  content: string;
  platforms: Platform[];
  schedule_mode: 'now' | 'scheduled';
  scheduled_at?: string;
  agent: string;
  timestamp: string;
}

export async function sendToZapier(payload: ZapierPayload): Promise<{ ok: boolean; error?: string }> {
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
