/**
 * Vercel Serverless Function: POST /api/telegram-webhook
 *
 * The single brain of the Telegram bot. Telegram delivers every message here
 * instantly (webhook mode), so replies are immediate. This replaces the old
 * GitHub Actions polling bot: once the webhook is set, polling stops working,
 * so all command handling lives here too.
 *
 * Two kinds of messages:
 *   1. From the owner (TELEGRAM_CHAT_ID): slash commands (/task, /tasks, /done,
 *      /status, /ping, /help).
 *   2. From anyone else (a client): an AI receptionist replies in Hebrew and a
 *      copy of the exchange is forwarded to the owner.
 *
 * Env vars (set in the Vercel dashboard):
 *   TELEGRAM_BOT_TOKEN   (required) bot token from @BotFather
 *   TELEGRAM_CHAT_ID     (required) the owner's numeric chat id
 *   ANTHROPIC_API_KEY    (required for AI replies) from console.anthropic.com
 *   WEBHOOK_SECRET       (recommended) shared secret; must match the value used
 *                        with setWebhook so random POSTs are rejected
 *   GITHUB_TOKEN         (optional) PAT with issues scope, enables task commands
 */

const TELEGRAM_API = 'https://api.telegram.org';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const REPO = 'lalomavi-collab/desktop-tutorial';

const RECEPTIONIST_PROMPT = `אתה פקיד הקבלה הווירטואלי של LALUM, משרד עורכי דין (עו"ד לалו מави).
אתה עונה ללקוחות ופונים שכותבים למשרד בטלגרם.

הכללים שלך:
- כתוב בעברית, בטון חם, מקצועי ומכבד.
- אתה פקיד קבלה, לא עורך דין. אל תיתן ייעוץ משפטי, אל תפרש חוק, ואל תתחייב בשם המשרד.
- המטרה שלך: לקבל בברכה, להבין בקצרה מה הפונה צריך, ולאסוף פרטים (שם מלא, נושא הפנייה, וטלפון לחזרה).
- הבהר שעורך דין מהמשרד יחזור אליו בהקדם. אל תיתן הבטחות לגבי תוצאות או לוחות זמנים מדויקים.
- אם שואלים שאלה משפטית, אמור בעדינות שעו"ד יתייחס לכך אישית, ובקש את הפרטים ליצירת קשר.
- שמור על תשובות קצרות, שתיים עד ארבע שורות.
- אל תשתמש במקפים כסימני פיסוק. השתמש בפסיק, נקודה, או סוגריים.`;

async function telegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function sendMessage(chatId, text) {
  return telegram('sendMessage', { chat_id: chatId, text });
}

async function gh(path, method = 'GET', body = null) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { _error: 'no-token' };
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return { _error: res.status };
  const raw = await res.text();
  return raw ? JSON.parse(raw) : {};
}

async function aiReply(userText) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return 'שלום, קיבלנו את פנייתך. עורך דין מהמשרד יחזור אליך בהקדם. אנא השאר שם וטלפון לחזרה.';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: RECEPTIONIST_PROMPT,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) {
    return 'שלום, קיבלנו את פנייתך. עורך דין מהמשרד יחזור אליך בהקדם. אנא השאר שם וטלפון לחזרה.';
  }
  const data = await res.json();
  return data?.content?.[0]?.text?.trim()
    || 'שלום, קיבלנו את פנייתך. עורך דין מהמשרד יחזור אליך בהקדם.';
}

async function handleCommand(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().split('@')[0];
  const args = parts.slice(1);

  if (cmd === '/ping') return '🏓 הבוט פעיל ועובד (webhook, מיידי)';

  if (cmd === '/help') {
    return [
      '🤖 פקודות זמינות:',
      '',
      '/ping: בדיקה שהבוט פעיל',
      '/status: סטטוס ריצות אחרונות',
      '/task תיאור: יצירת משימה חדשה',
      '/tasks: רשימת משימות פתוחות',
      '/done 12: סגירת משימה מספר 12',
      '',
      'הודעות מלקוחות מקבלות מענה אוטומטי, ואתה מקבל עותק.',
    ].join('\n');
  }

  if (cmd === '/status') {
    const result = await gh('/actions/runs?per_page=5');
    if (result._error) return '❌ סטטוס דורש GITHUB_TOKEN מוגדר ב-Vercel';
    const runs = result.workflow_runs || [];
    if (!runs.length) return 'אין ריצות';
    const icons = { success: '✅', failure: '❌', cancelled: '⛔' };
    const lines = runs.map(
      (r) => `${icons[r.conclusion] || '⏳'} ${r.name.slice(0, 28)} (${r.created_at.slice(0, 10)})`
    );
    return '📊 ריצות אחרונות:\n\n' + lines.join('\n');
  }

  if (cmd === '/task') {
    if (!args.length) return 'שימוש: /task תיאור המשימה';
    const title = args.join(' ');
    const result = await gh('/issues', 'POST', { title, labels: ['task', 'from-telegram'] });
    return result.number
      ? `📝 משימה #${result.number} נוצרה: ${title}`
      : '❌ יצירת משימה דורשת GITHUB_TOKEN מוגדר ב-Vercel';
  }

  if (cmd === '/tasks') {
    const result = await gh('/issues?state=open&labels=task&per_page=10');
    if (result._error) return '❌ שליפת משימות דורשת GITHUB_TOKEN מוגדר ב-Vercel';
    if (!Array.isArray(result) || !result.length) return '🎉 אין משימות פתוחות';
    return '📋 משימות פתוחות:\n' + result.map((i) => `#${i.number}: ${i.title}`).join('\n');
  }

  if (cmd === '/done') {
    const num = (args[0] || '').replace('#', '');
    if (!/^\d+$/.test(num)) return 'שימוש: /done 12';
    const result = await gh(`/issues/${num}`, 'PATCH', { state: 'closed' });
    return result.number ? `✅ משימה #${num} נסגרה` : `❌ לא הצלחתי לסגור משימה #${num}`;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject spoofed calls: Telegram echoes the secret token set via setWebhook.
  const expected = process.env.WEBHOOK_SECRET;
  if (expected && req.headers['x-telegram-bot-api-secret-token'] !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Always ack Telegram fast so it does not retry.
  res.status(200).json({ ok: true });

  try {
    const msg = req.body?.message;
    if (!msg || !msg.text) return;

    const chatId = String(msg.chat.id);
    const ownerId = String(process.env.TELEGRAM_CHAT_ID || '');
    const text = msg.text;

    if (chatId === ownerId) {
      if (text.startsWith('/')) {
        const reply = await handleCommand(text);
        if (reply) await sendMessage(chatId, reply);
      }
      return;
    }

    // External sender: AI receptionist replies, owner gets a copy.
    const fromName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'לא ידוע';
    const reply = await aiReply(text);
    await sendMessage(chatId, reply);

    if (ownerId) {
      await sendMessage(
        ownerId,
        [
          '📨 פנייה חדשה מלקוח',
          `מאת: ${fromName} (chat ${chatId})`,
          '',
          `הלקוח: ${text}`,
          `הבוט ענה: ${reply}`,
        ].join('\n')
      );
    }
  } catch (err) {
    // Telegram was already acked; log for Vercel function logs.
    console.error('telegram-webhook error:', err);
  }
}
