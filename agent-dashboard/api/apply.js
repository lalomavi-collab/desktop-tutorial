/**
 * Vercel Serverless Function: POST /api/apply
 * Sends a job application cover letter via Microsoft Graph API (Outlook).
 *
 * Body: { to_email, subject, cover_letter, company, title }
 * Env vars (set in Vercel dashboard):
 *   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to_email, subject, cover_letter, company, title } = req.body ?? {};

  if (!to_email || !subject || !cover_letter) {
    return res.status(400).json({ error: 'Missing required fields: to_email, subject, cover_letter' });
  }

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER } = process.env;

  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_SENDER) {
    return res.status(500).json({ error: 'Missing Microsoft Graph credentials in environment' });
  }

  try {
    // 1. Get access token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Failed to get access token', detail: tokenData });
    }

    // 2. Send email via Graph API
    const mailRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${MS_SENDER}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'Text', content: cover_letter },
            toRecipients: [{ emailAddress: { address: to_email } }],
          },
          saveToSentItems: true,
        }),
      }
    );

    if (mailRes.status === 202) {
      return res.status(200).json({
        success: true,
        message: `Cover letter sent to ${to_email}`,
        company,
        title,
        sentAt: new Date().toISOString(),
      });
    } else {
      const errText = await mailRes.text();
      return res.status(500).json({ error: `Graph API error ${mailRes.status}`, detail: errText.slice(0, 300) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
