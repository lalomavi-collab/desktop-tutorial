import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLATFORM_WEBHOOKS,
  TELEGRAM_WEBHOOK,
  broadcastAll,
  buildMotzeiShabbatPayload,
  sendToTelegram,
  sendToZapier,
  type ZapierPayload,
} from '../zapier';

const basePayload: ZapierPayload = {
  content: 'hello',
  platforms: [],
  schedule_mode: 'now',
  agent: 'test-agent',
  timestamp: '2026-04-15T00:00:00.000Z',
};

interface FetchCall {
  url: string;
  init: RequestInit;
}

function installFetchMock(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// sendToZapier
// ────────────────────────────────────────────────────────────────────────────

describe('sendToZapier', () => {
  it('hits the per-platform webhook for each requested platform', async () => {
    const calls = installFetchMock(async () => new Response(null, { status: 200 }));
    const result = await sendToZapier({
      ...basePayload,
      platforms: ['linkedin', 'facebook'],
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls.map(c => c.url)).toEqual([
      PLATFORM_WEBHOOKS.linkedin,
      PLATFORM_WEBHOOKS.facebook,
    ]);
  });

  it('narrows the platforms array per request to a single platform', async () => {
    const calls = installFetchMock(async () => new Response(null, { status: 200 }));
    await sendToZapier({ ...basePayload, platforms: ['linkedin', 'facebook'] });
    for (const call of calls) {
      const body = JSON.parse(call.init.body as string);
      expect(body.platforms).toHaveLength(1);
    }
  });

  it('returns the first failure when any webhook is non-2xx', async () => {
    installFetchMock(async (url) => {
      if (url === PLATFORM_WEBHOOKS.facebook) {
        return new Response(null, { status: 500 });
      }
      return new Response(null, { status: 200 });
    });
    const result = await sendToZapier({
      ...basePayload,
      platforms: ['linkedin', 'facebook'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 500/);
  });

  it('captures network errors from fetch as an error result', async () => {
    installFetchMock(async () => { throw new Error('boom'); });
    const result = await sendToZapier({ ...basePayload, platforms: ['linkedin'] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('sends Content-Type application/json', async () => {
    const calls = installFetchMock(async () => new Response(null, { status: 200 }));
    await sendToZapier({ ...basePayload, platforms: ['linkedin'] });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(calls[0].init.method).toBe('POST');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// sendToTelegram
// ────────────────────────────────────────────────────────────────────────────

describe('sendToTelegram', () => {
  it('posts to the dedicated Telegram webhook with empty platforms array', async () => {
    const calls = installFetchMock(async () => new Response(null, { status: 200 }));
    const result = await sendToTelegram(basePayload);
    expect(result.ok).toBe(true);
    expect(result.platform).toBe('telegram');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TELEGRAM_WEBHOOK);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.platforms).toEqual([]);
  });

  it('returns ok=false on HTTP error and tags platform=telegram', async () => {
    installFetchMock(async () => new Response(null, { status: 502 }));
    const result = await sendToTelegram(basePayload);
    expect(result.ok).toBe(false);
    expect(result.platform).toBe('telegram');
    expect(result.error).toMatch(/HTTP 502/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// broadcastAll
// ────────────────────────────────────────────────────────────────────────────

describe('broadcastAll', () => {
  it('returns one result per platform plus telegram', async () => {
    installFetchMock(async () => new Response(null, { status: 200 }));
    const results = await broadcastAll({
      ...basePayload,
      platforms: ['linkedin', 'facebook'],
    });
    expect(results).toHaveLength(3);
    const platforms = results.map(r => r.platform).sort();
    expect(platforms).toEqual(['facebook', 'linkedin', 'telegram']);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('reports per-platform failures independently', async () => {
    installFetchMock(async (url) => {
      if (url === TELEGRAM_WEBHOOK) return new Response(null, { status: 500 });
      return new Response(null, { status: 200 });
    });
    const results = await broadcastAll({
      ...basePayload,
      platforms: ['linkedin'],
    });
    const tg = results.find(r => r.platform === 'telegram');
    const li = results.find(r => r.platform === 'linkedin');
    expect(li?.ok).toBe(true);
    expect(tg?.ok).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildMotzeiShabbatPayload — DST-sensitive UTC conversion
// ────────────────────────────────────────────────────────────────────────────

describe('buildMotzeiShabbatPayload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses 16:00 UTC during DST (April → October)', () => {
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z')); // April → DST
    const p = buildMotzeiShabbatPayload('hello', ['linkedin']);
    expect(p.utc_time).toBe('Saturday 16:00 UTC');
    expect(p.schedule_mode).toBe('motzei_shabbat');
    expect(p.israel_time).toMatch(/Saturday 19:00/);
  });

  it('uses 17:00 UTC during standard time (Jan → Feb, Nov → Dec)', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z')); // January → no DST
    const p = buildMotzeiShabbatPayload('hello', ['linkedin']);
    expect(p.utc_time).toBe('Saturday 17:00 UTC');
  });

  it('passes through content, platforms, and imageUrl', () => {
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    const p = buildMotzeiShabbatPayload('text', ['facebook'], 'https://img');
    expect(p.content).toBe('text');
    expect(p.platforms).toEqual(['facebook']);
    expect(p.image_url).toBe('https://img');
  });
});
