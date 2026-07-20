/**
 * Vercel Serverless Function: GET /api/set-webhook
 *
 * One-time helper to register (or refresh) the Telegram webhook so it points at
 * this deployment's /api/telegram-webhook endpoint. Open it once in a browser
 * after deploying and after setting the env vars.
 *
 * Protected by SETUP_KEY: call /api/set-webhook?key=YOUR_SETUP_KEY
 *
 * Env vars: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET, SETUP_KEY
 */

export default async function handler(req, res) {
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey || req.query.key !== setupKey) {
    return res.status(401).json({ error: 'Provide the correct ?key= (SETUP_KEY)' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `https://${host}/api/telegram-webhook`;

  const body = { url };
  if (process.env.WEBHOOK_SECRET) body.secret_token = process.env.WEBHOOK_SECRET;

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await tgRes.json();
  return res.status(200).json({ registeredUrl: url, telegram: result });
}
