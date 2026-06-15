import { PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = import.meta.env.VITE_OUTLOOK_CLIENT_ID;
const TENANT_ID = import.meta.env.VITE_OUTLOOK_TENANT_ID || "consumers";

export const msalEnabled = !!CLIENT_ID;

let pca = null;
function getMsal() {
  if (!pca && CLIENT_ID) {
    pca = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
  }
  return pca;
}

const SCOPES = ["User.Read", "Mail.Send"];

export async function outlookSignIn() {
  const msal = getMsal();
  if (!msal) return null;
  await msal.initialize();
  try {
    const res = await msal.loginPopup({ scopes: SCOPES });
    return res.account;
  } catch { return null; }
}

export async function outlookSignOut() {
  const msal = getMsal();
  if (!msal) return;
  await msal.initialize();
  const accounts = msal.getAllAccounts();
  if (accounts.length) await msal.logoutPopup({ account: accounts[0] });
}

export function getOutlookAccount() {
  const msal = getMsal();
  if (!msal) return null;
  const accounts = msal.getAllAccounts();
  return accounts[0] || null;
}

async function getToken() {
  const msal = getMsal();
  if (!msal) return null;
  await msal.initialize();
  const account = msal.getAllAccounts()[0];
  if (!account) return null;
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch {
    try {
      const res = await msal.acquireTokenPopup({ scopes: SCOPES, account });
      return res.accessToken;
    } catch { return null; }
  }
}

// Send an invoice email via Microsoft Graph.
// pdfBase64: base64 string of the PDF (without data: prefix)
export async function sendInvoiceEmail({ toEmail, toName, invoiceNumber, amount, pdfBase64 }) {
  const token = await getToken();
  if (!token) throw new Error("לא מחובר לאאוטלוק");

  const body = {
    message: {
      subject: `חשבונית ${invoiceNumber} - ALGO Legal Billing`,
      body: {
        contentType: "HTML",
        content: `
          <div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
            <p>שלום ${toName || toEmail},</p>
            <p>מצורפת חשבונית <strong>${invoiceNumber}</strong> על סך <strong>${amount}</strong>.</p>
            <p>לתשלום תוך 30 יום.</p>
            <br/>
            <p>בכבוד רב,<br/>משרד לאלום</p>
          </div>
        `,
      },
      toRecipients: [{ emailAddress: { address: toEmail, name: toName || toEmail } }],
      attachments: pdfBase64 ? [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `${invoiceNumber}.pdf`,
        contentType: "application/pdf",
        contentBytes: pdfBase64,
      }] : [],
    },
    saveToSentItems: true,
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Graph error ${res.status}`);
  }
}
