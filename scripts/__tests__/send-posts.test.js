/**
 * Tests for scripts/send-posts.js
 *
 * Uses Node's built-in test runner (`node --test`) — no extra deps.
 * Each test that needs a different module-level env (e.g. FORCE_POST_ID,
 * webhook URLs) loads the module via `loadFresh()` to bust the cache.
 */

'use strict';

const test       = require('node:test');
const assert     = require('node:assert/strict');
const fs         = require('node:fs');
const path       = require('node:path');

const MODULE_PATH = require.resolve('../send-posts.js');
const QUEUE_PATH  = path.join(__dirname, '..', '..', 'posts-queue.json');

/** Re-require the script with a clean require-cache and given env overrides. */
function loadFresh(envOverrides = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, envOverrides);
  delete require.cache[MODULE_PATH];
  try {
    return require('../send-posts.js');
  } finally {
    // Restore env so the next test starts clean.
    for (const k of Object.keys(envOverrides)) {
      if (k in previous) process.env[k] = previous[k];
      else delete process.env[k];
    }
  }
}

const approved = (overrides = {}) => ({
  id: 'p1',
  status: 'approved',
  topic: 't',
  content: 'c',
  platforms: ['telegram'],
  ...overrides,
});

// ────────────────────────────────────────────────────────────────────────────
// isReadyToSend
// ────────────────────────────────────────────────────────────────────────────

test('isReadyToSend: rejects non-approved posts', () => {
  const { isReadyToSend } = loadFresh();
  for (const status of ['pending', 'rejected', 'sent', 'failed', 'draft']) {
    assert.equal(isReadyToSend(approved({ status })), false, `status=${status}`);
  }
});

test('isReadyToSend: approved + no scheduledFor sends immediately', () => {
  const { isReadyToSend } = loadFresh();
  assert.equal(isReadyToSend(approved()), true);
});

test('isReadyToSend: scheduled in the future is NOT ready', () => {
  const { isReadyToSend } = loadFresh();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isReadyToSend(approved({ scheduledFor: future })), false);
});

test('isReadyToSend: scheduled within 10-minute window IS ready', () => {
  const { isReadyToSend } = loadFresh();
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  assert.equal(isReadyToSend(approved({ scheduledFor: fiveMinAgo })), true);
});

test('isReadyToSend: scheduled exactly at "now" IS ready (boundary)', () => {
  const { isReadyToSend } = loadFresh();
  const now = new Date().toISOString();
  assert.equal(isReadyToSend(approved({ scheduledFor: now })), true);
});

test('isReadyToSend: scheduled more than 10 minutes ago is NOT ready', () => {
  const { isReadyToSend } = loadFresh();
  const eleven = new Date(Date.now() - 11 * 60_000).toISOString();
  assert.equal(isReadyToSend(approved({ scheduledFor: eleven })), false);
});

test('isReadyToSend: FORCE_POST_ID matches the right post', () => {
  const { isReadyToSend } = loadFresh({ FORCE_POST_ID: 'p1' });
  // Post with matching id is sendable even if scheduled in the future.
  const future = new Date(Date.now() + 3600_000).toISOString();
  assert.equal(isReadyToSend(approved({ scheduledFor: future })), true);
  // Different id is rejected.
  assert.equal(isReadyToSend(approved({ id: 'other' })), false);
});

test('isReadyToSend: FORCE_POST_ID still requires status=approved', () => {
  const { isReadyToSend } = loadFresh({ FORCE_POST_ID: 'p1' });
  assert.equal(isReadyToSend(approved({ status: 'pending' })), false);
});

// ────────────────────────────────────────────────────────────────────────────
// sendWebhook
// ────────────────────────────────────────────────────────────────────────────

test('sendWebhook: posts JSON body and resolves on 2xx', async () => {
  const { sendWebhook } = loadFresh();
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  try {
    await sendWebhook('https://example.com/hook', { hello: 'world' });
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.com/hook');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { hello: 'world' });
});

test('sendWebhook: throws on non-2xx with the HTTP status in the message', async () => {
  const { sendWebhook } = loadFresh();
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      () => sendWebhook('https://example.com', {}),
      /HTTP 503/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendWebhook: propagates network errors', async () => {
  const { sendWebhook } = loadFresh();
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    await assert.rejects(
      () => sendWebhook('https://example.com', {}),
      /ECONNREFUSED/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

// ────────────────────────────────────────────────────────────────────────────
// main()  — end-to-end happy path with in-memory queue
// ────────────────────────────────────────────────────────────────────────────

function withTempQueue(queue) {
  const original = fs.existsSync(QUEUE_PATH)
    ? fs.readFileSync(QUEUE_PATH, 'utf-8')
    : null;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
  return () => {
    if (original === null) fs.unlinkSync(QUEUE_PATH);
    else fs.writeFileSync(QUEUE_PATH, original);
  };
}

test('main: dry-run does not call fetch and does not mutate queue contents', async () => {
  const queue = [approved({ id: 'dry-1' })];
  const restore = withTempQueue(queue);
  const beforeContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => { fetchCalls++; return { ok: true, status: 200 }; };

  // Silence stdout for the duration of main().
  const originalLog = console.log;
  console.log = () => {};
  try {
    const { main } = loadFresh({
      DRY_RUN: 'true',
      ZAPIER_TELEGRAM: 'https://example.com/tg',
    });
    await main();
  } finally {
    console.log = originalLog;
    global.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0, 'no fetch in dry run');
  // Content must be byte-identical.
  assert.equal(fs.readFileSync(QUEUE_PATH, 'utf-8'), beforeContent);

  restore();
});

test('main: marks post as sent on success and writes queue back', async () => {
  const queue = [approved({ id: 'live-1', platforms: ['telegram'] })];
  const restore = withTempQueue(queue);
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200 });

  const originalLog = console.log;
  const originalErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const { main } = loadFresh({
      ZAPIER_TELEGRAM: 'https://example.com/tg',
      DRY_RUN: 'false',
    });
    await main();
  } finally {
    console.log = originalLog;
    console.error = originalErr;
    global.fetch = originalFetch;
  }

  const written = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  assert.equal(written[0].status, 'sent');
  assert.ok(written[0].sentAt, 'sentAt timestamp present');
  assert.deepEqual(written[0].results, [{ platform: 'telegram', ok: true }]);

  restore();
});

test('main: marks post as failed when webhook returns non-2xx', async () => {
  const queue = [approved({ id: 'fail-1', platforms: ['telegram'] })];
  const restore = withTempQueue(queue);
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500 });

  const originalLog = console.log;
  const originalErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const { main } = loadFresh({
      ZAPIER_TELEGRAM: 'https://example.com/tg',
      DRY_RUN: 'false',
    });
    await main();
  } finally {
    console.log = originalLog;
    console.error = originalErr;
    global.fetch = originalFetch;
  }

  const written = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  assert.equal(written[0].status, 'failed');
  assert.equal(written[0].sentAt, undefined);
  assert.equal(written[0].results[0].ok, false);
  assert.match(written[0].results[0].error, /HTTP 500/);

  restore();
});

test('main: skips platforms with no webhook configured', async () => {
  const queue = [approved({
    id: 'skip-1',
    platforms: ['telegram', 'instagram'],
  })];
  const restore = withTempQueue(queue);
  let fetchCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { fetchCount++; return { ok: true, status: 200 }; };

  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    const { main } = loadFresh({
      ZAPIER_TELEGRAM: 'https://example.com/tg',
      // no instagram webhook
      DRY_RUN: 'false',
    });
    await main();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    global.fetch = originalFetch;
  }

  // Only one platform was actually called.
  assert.equal(fetchCount, 1);
  const written = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  // Mixed result → status is failed, no sentAt.
  assert.equal(written[0].status, 'failed');
  assert.equal(written[0].results.length, 2);
  const ig = written[0].results.find(r => r.platform === 'instagram');
  assert.equal(ig.ok, false);
  assert.equal(ig.error, 'no webhook');

  restore();
});

test('main: applies platformOverrides for content', async () => {
  const queue = [approved({
    id: 'ovr-1',
    platforms: ['telegram'],
    content: 'default content',
    platformOverrides: { telegram: 'override for tg' },
  })];
  const restore = withTempQueue(queue);
  let captured;
  const originalFetch = global.fetch;
  global.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return { ok: true, status: 200 };
  };

  const originalLog = console.log;
  console.log = () => {};
  try {
    const { main } = loadFresh({
      ZAPIER_TELEGRAM: 'https://example.com/tg',
      DRY_RUN: 'false',
    });
    await main();
  } finally {
    console.log = originalLog;
    global.fetch = originalFetch;
    restore();
  }

  assert.equal(captured.content, 'override for tg');
  assert.equal(captured.post_id, 'ovr-1');
  assert.deepEqual(captured.platforms, ['telegram']);
});
