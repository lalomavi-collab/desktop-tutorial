#!/usr/bin/env node
/**
 * עידית — Social Media Agent
 * Reads posts-queue.json, sends approved posts via Zapier webhooks,
 * marks them as sent, and writes the updated queue back.
 */

const fs   = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '..', 'posts-queue.json');

const WEBHOOKS = {
  telegram:  process.env.ZAPIER_TELEGRAM,
  linkedin:  process.env.ZAPIER_LINKEDIN,
  facebook:  process.env.ZAPIER_FACEBOOK,
  twitter:   process.env.ZAPIER_TWITTER,
  instagram: process.env.ZAPIER_INSTAGRAM,
};

const DRY_RUN      = process.env.DRY_RUN === 'true';
const FORCE_ID     = process.env.FORCE_POST_ID?.trim() || null;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendWebhook(url, payload) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

function isReadyToSend(post) {
  if (post.status !== 'approved') return false;
  if (FORCE_ID) return post.id === FORCE_ID;
  // Scheduled posts: send only if within a 10-min window past their time
  if (post.scheduledFor) {
    const scheduled = new Date(post.scheduledFor).getTime();
    const now       = Date.now();
    const diff      = now - scheduled;
    return diff >= 0 && diff <= 10 * 60 * 1000;
  }
  // Unscheduled approved posts: send immediately
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🤖 עידית — Social Media Agent`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`${DRY_RUN ? '🔍 DRY RUN — לא שולח בפועל' : '🚀 שולח לרשתות...'}\n`);

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  const toSend = queue.filter(isReadyToSend);

  if (toSend.length === 0) {
    console.log('ℹ️  אין פוסטים מאושרים לשליחה כרגע.');
    return;
  }

  console.log(`📋 נמצאו ${toSend.length} פוסטים לשליחה:\n`);

  for (const post of toSend) {
    console.log(`▶ "${post.topic}" → ${post.platforms.join(', ')}`);

    if (DRY_RUN) {
      console.log(`  [DRY] תוכן: ${post.content.slice(0, 80)}...`);
      continue;
    }

    const results = [];

    for (const platform of post.platforms) {
      const webhookUrl = WEBHOOKS[platform];
      if (!webhookUrl) {
        console.warn(`  ⚠️  אין webhook ל-${platform} — מדלג`);
        results.push({ platform, ok: false, error: 'no webhook' });
        continue;
      }

      const content = post.platformOverrides?.[platform]?.trim() || post.content;

      try {
        await sendWebhook(webhookUrl, {
          content,
          platforms:     [platform],
          topic:         post.topic,
          schedule_mode: 'now',
          agent:         post.createdBy || 'עידית — מנהלת השיווק',
          timestamp:     new Date().toISOString(),
          post_id:       post.id,
          ...(post.imageUrl ? { image_url: post.imageUrl } : {}),
        });
        console.log(`  ✅ ${platform}`);
        results.push({ platform, ok: true });
      } catch (err) {
        console.error(`  ❌ ${platform}: ${err.message}`);
        results.push({ platform, ok: false, error: err.message });
      }
    }

    // Update status in queue
    const allOk = results.every(r => r.ok);
    const idx   = queue.findIndex(p => p.id === post.id);
    if (idx !== -1) {
      queue[idx] = {
        ...queue[idx],
        status:  allOk ? 'sent' : 'failed',
        sentAt:  allOk ? new Date().toISOString() : undefined,
        results,
      };
    }

    console.log(`  → ${allOk ? '✅ נשלח' : '❌ נכשל'}\n`);
  }

  // Write updated queue back
  if (!DRY_RUN) {
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf-8');
    console.log('💾 תור הפוסטים עודכן.');
  }

  console.log('\n✔ הסוכן סיים.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
