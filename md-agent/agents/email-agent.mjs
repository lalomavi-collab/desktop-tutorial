#!/usr/bin/env node

import inquirer from "inquirer";
import { ConfidentialClientApplication, PublicClientApplication } from "@azure/msal-node";
import fetch from "node-fetch";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, "..", ".email-config.json");

// ─── Colors ───────────────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function banner() {
  console.log("");
  console.log(cyan("  ╔══════════════════════════════════════════╗"));
  console.log(cyan("  ║") + bold("     Email Agent — Outlook Mail Manager   ") + cyan("║"));
  console.log(cyan("  ╚══════════════════════════════════════════╝"));
  console.log(dim("  Read, search, summarize & send emails via Microsoft Graph.\n"));
}

// ─── Config Management ────────────────────────────────────────────────
function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  }
  return null;
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
}

async function setupConfig() {
  console.log(yellow("\n  First-time setup — Microsoft Azure App credentials needed."));
  console.log(dim("  To get these, go to: https://portal.azure.com → Azure Active Directory"));
  console.log(dim("  → App registrations → New registration\n"));
  console.log(dim("  Required API permissions: Mail.Read, Mail.Send, Mail.ReadWrite\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "clientId",
      message: "Application (client) ID:",
      validate: (v) => (v.trim() ? true : "Required"),
    },
    {
      type: "input",
      name: "tenantId",
      message: "Directory (tenant) ID (or 'common' for personal):",
      default: "common",
    },
    {
      type: "list",
      name: "authMethod",
      message: "Authentication method:",
      choices: [
        { name: "Device Code Flow (recommended — no secret needed)", value: "device" },
        { name: "Client Secret (for app-only access)", value: "secret" },
      ],
    },
  ]);

  if (answers.authMethod === "secret") {
    const { clientSecret } = await inquirer.prompt([
      {
        type: "password",
        name: "clientSecret",
        message: "Client Secret:",
        validate: (v) => (v.trim() ? true : "Required"),
      },
    ]);
    answers.clientSecret = clientSecret;
  }

  saveConfig(answers);
  console.log(green("\n  Configuration saved!\n"));
  return answers;
}

// ─── Microsoft Graph Auth ─────────────────────────────────────────────
const SCOPES = ["https://graph.microsoft.com/Mail.Read", "https://graph.microsoft.com/Mail.Send", "https://graph.microsoft.com/Mail.ReadWrite"];

async function getAccessToken(config) {
  if (config.authMethod === "device") {
    const pca = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });

    // Try cache first
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      try {
        const silentResult = await pca.acquireTokenSilent({
          scopes: SCOPES,
          account: accounts[0],
        });
        return silentResult.accessToken;
      } catch {
        // Fall through to device code
      }
    }

    const deviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        console.log(yellow(`\n  ${response.message}\n`));
      },
    };

    const result = await pca.acquireTokenByDeviceCode(deviceCodeRequest);
    return result.accessToken;
  } else {
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });

    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });
    return result.accessToken;
  }
}

// ─── Microsoft Graph API Calls ────────────────────────────────────────
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphGet(token, endpoint) {
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph API error (${response.status}): ${err}`);
  }
  return response.json();
}

async function graphPost(token, endpoint, body) {
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Graph API error (${response.status}): ${err}`);
  }
  if (response.status === 202 || response.headers.get("content-length") === "0") return {};
  return response.json();
}

// ─── Email Formatting ─────────────────────────────────────────────────
function formatEmail(mail, index) {
  const from = mail.from?.emailAddress?.name || mail.from?.emailAddress?.address || "Unknown";
  const date = new Date(mail.receivedDateTime).toLocaleString("he-IL");
  const read = mail.isRead ? dim("✓") : green("●");
  const flag = mail.flag?.flagStatus === "flagged" ? yellow(" ⚑") : "";
  const hasAttach = mail.hasAttachments ? dim(" 📎") : "";

  return `  ${read} ${dim(`${index + 1}.`)} ${bold(from)}${flag}${hasAttach}\n     ${mail.subject}\n     ${dim(date)}`;
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Features ─────────────────────────────────────────────────────────

// 1. Read recent emails
async function readEmails(token) {
  const { count } = await inquirer.prompt([
    {
      type: "list",
      name: "count",
      message: "How many recent emails?",
      choices: ["5", "10", "20", "50"],
      default: "10",
    },
  ]);

  const { folder } = await inquirer.prompt([
    {
      type: "list",
      name: "folder",
      message: "Which folder?",
      choices: [
        { name: "Inbox", value: "inbox" },
        { name: "Sent Items", value: "sentitems" },
        { name: "Drafts", value: "drafts" },
        { name: "Archive", value: "archive" },
      ],
    },
  ]);

  console.log(dim("\n  Fetching emails...\n"));

  const data = await graphGet(
    token,
    `/me/mailFolders/${folder}/messages?$top=${count}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,flag,hasAttachments,bodyPreview`
  );

  if (!data.value || data.value.length === 0) {
    console.log(yellow("  No emails found.\n"));
    return;
  }

  console.log(bold(`  ${data.value.length} emails in ${folder}:\n`));
  data.value.forEach((mail, i) => console.log(formatEmail(mail, i) + "\n"));

  // Option to read full email
  const { readFull } = await inquirer.prompt([
    {
      type: "confirm",
      name: "readFull",
      message: "Read a full email?",
      default: false,
    },
  ]);

  if (readFull) {
    const { emailIndex } = await inquirer.prompt([
      {
        type: "number",
        name: "emailIndex",
        message: "Email number:",
        validate: (v) => (v >= 1 && v <= data.value.length ? true : `Enter 1-${data.value.length}`),
      },
    ]);

    const mail = data.value[emailIndex - 1];
    const fullMail = await graphGet(token, `/me/messages/${mail.id}`);

    console.log(bold(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(bold(`  From:    `) + (fullMail.from?.emailAddress?.address || "Unknown"));
    console.log(bold(`  To:      `) + (fullMail.toRecipients?.map((r) => r.emailAddress.address).join(", ") || ""));
    console.log(bold(`  Subject: `) + fullMail.subject);
    console.log(bold(`  Date:    `) + new Date(fullMail.receivedDateTime).toLocaleString("he-IL"));
    console.log(bold(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));

    const body = fullMail.body?.contentType === "html"
      ? stripHtml(fullMail.body.content)
      : fullMail.body?.content || "";

    // Show body, limited to reasonable length
    const lines = body.split(/\n/).filter(Boolean);
    lines.slice(0, 30).forEach((line) => console.log(`  ${line.trim()}`));
    if (lines.length > 30) console.log(dim(`\n  ... (${lines.length - 30} more lines)`));
    console.log("");
  }
}

// 2. Search emails
async function searchEmails(token) {
  const { query } = await inquirer.prompt([
    {
      type: "input",
      name: "query",
      message: "Search query (subject, sender, or keyword):",
      validate: (v) => (v.trim() ? true : "Required"),
    },
  ]);

  const { searchIn } = await inquirer.prompt([
    {
      type: "list",
      name: "searchIn",
      message: "Search in:",
      choices: [
        { name: "Subject", value: "subject" },
        { name: "From (sender)", value: "from" },
        { name: "Body content", value: "body" },
        { name: "Everything", value: "all" },
      ],
    },
  ]);

  console.log(dim("\n  Searching...\n"));

  let filter;
  switch (searchIn) {
    case "subject":
      filter = `$search="subject:${query}"`;
      break;
    case "from":
      filter = `$search="from:${query}"`;
      break;
    case "body":
      filter = `$search="body:${query}"`;
      break;
    default:
      filter = `$search="${query}"`;
  }

  const data = await graphGet(
    token,
    `/me/messages?${filter}&$top=15&$select=subject,from,receivedDateTime,isRead,flag,hasAttachments,bodyPreview`
  );

  if (!data.value || data.value.length === 0) {
    console.log(yellow("  No results found.\n"));
    return;
  }

  console.log(bold(`  ${data.value.length} result(s):\n`));
  data.value.forEach((mail, i) => console.log(formatEmail(mail, i) + "\n"));
}

// 3. Summarize emails
async function summarizeEmails(token) {
  const { count } = await inquirer.prompt([
    {
      type: "list",
      name: "count",
      message: "Summarize how many recent emails?",
      choices: ["5", "10", "20"],
      default: "10",
    },
  ]);

  console.log(dim("\n  Fetching and analyzing...\n"));

  const data = await graphGet(
    token,
    `/me/mailFolders/inbox/messages?$top=${count}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,flag,hasAttachments,bodyPreview,importance`
  );

  if (!data.value || data.value.length === 0) {
    console.log(yellow("  No emails to summarize.\n"));
    return;
  }

  const mails = data.value;

  // Stats
  const unread = mails.filter((m) => !m.isRead).length;
  const flagged = mails.filter((m) => m.flag?.flagStatus === "flagged").length;
  const highImportance = mails.filter((m) => m.importance === "high").length;
  const withAttachments = mails.filter((m) => m.hasAttachments).length;

  // Group by sender
  const bySender = {};
  mails.forEach((m) => {
    const sender = m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown";
    bySender[sender] = (bySender[sender] || 0) + 1;
  });

  const topSenders = Object.entries(bySender)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Group by time
  const today = new Date();
  const todayMails = mails.filter((m) => {
    const d = new Date(m.receivedDateTime);
    return d.toDateString() === today.toDateString();
  });

  console.log(bold("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(bold("  📊 Email Summary"));
  console.log(bold("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

  console.log(`  Total:          ${bold(String(mails.length))}`);
  console.log(`  Unread:         ${unread > 0 ? yellow(String(unread)) : green("0")}`);
  console.log(`  Flagged:        ${flagged > 0 ? yellow(String(flagged)) : dim("0")}`);
  console.log(`  High priority:  ${highImportance > 0 ? red(String(highImportance)) : dim("0")}`);
  console.log(`  With files:     ${withAttachments > 0 ? cyan(String(withAttachments)) : dim("0")}`);
  console.log(`  Today:          ${bold(String(todayMails.length))}`);

  console.log(bold("\n  Top senders:"));
  topSenders.forEach(([name, count]) => {
    console.log(`    ${cyan(String(count))} — ${name}`);
  });

  // Unread highlights
  if (unread > 0) {
    console.log(bold("\n  Unread emails:"));
    mails
      .filter((m) => !m.isRead)
      .forEach((m) => {
        const from = m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown";
        const importance = m.importance === "high" ? red(" [HIGH]") : "";
        console.log(`    ${green("●")} ${bold(from)}${importance}: ${m.subject}`);
      });
  }

  // Flagged highlights
  if (flagged > 0) {
    console.log(bold("\n  Flagged (requires action):"));
    mails
      .filter((m) => m.flag?.flagStatus === "flagged")
      .forEach((m) => {
        const from = m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown";
        console.log(`    ${yellow("⚑")} ${bold(from)}: ${m.subject}`);
      });
  }

  console.log("");
}

// 4. Send email
async function sendEmail(token) {
  const { to } = await inquirer.prompt([
    {
      type: "input",
      name: "to",
      message: "To (email addresses, comma-separated):",
      validate: (v) => (v.trim() && v.includes("@") ? true : "Enter valid email(s)"),
    },
  ]);

  const { subject } = await inquirer.prompt([
    {
      type: "input",
      name: "subject",
      message: "Subject:",
      validate: (v) => (v.trim() ? true : "Required"),
    },
  ]);

  const { contentType } = await inquirer.prompt([
    {
      type: "list",
      name: "contentType",
      message: "Content type:",
      choices: [
        { name: "Plain text", value: "Text" },
        { name: "HTML", value: "HTML" },
      ],
    },
  ]);

  const { body } = await inquirer.prompt([
    {
      type: "editor",
      name: "body",
      message: "Email body (opens editor):",
    },
  ]);

  const { cc } = await inquirer.prompt([
    {
      type: "input",
      name: "cc",
      message: "CC (optional, comma-separated):",
      default: "",
    },
  ]);

  const { importance } = await inquirer.prompt([
    {
      type: "list",
      name: "importance",
      message: "Importance:",
      choices: ["normal", "high", "low"],
      default: "normal",
    },
  ]);

  // Build message
  const toRecipients = to.split(",").map((email) => ({
    emailAddress: { address: email.trim() },
  }));

  const ccRecipients = cc
    ? cc.split(",").map((email) => ({
        emailAddress: { address: email.trim() },
      }))
    : [];

  const message = {
    message: {
      subject,
      body: { contentType, content: body },
      toRecipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      importance,
    },
    saveToSentItems: true,
  };

  // Confirm
  console.log(bold("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(bold("  Preview:"));
  console.log(`  To:      ${to}`);
  if (cc) console.log(`  CC:      ${cc}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:    ${body.substring(0, 100)}${body.length > 100 ? "..." : ""}`);
  console.log(bold("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Send this email?",
      default: false,
    },
  ]);

  if (confirm) {
    console.log(dim("\n  Sending..."));
    await graphPost(token, "/me/sendMail", message);
    console.log(green("  ✓ Email sent successfully!\n"));
  } else {
    console.log(yellow("  Cancelled.\n"));
  }
}

// ─── Main Menu ────────────────────────────────────────────────────────
async function main() {
  banner();

  // Load or create config
  let config = loadConfig();
  if (!config) {
    config = await setupConfig();
  }

  // Authenticate
  console.log(dim("  Authenticating with Microsoft..."));
  let token;
  try {
    token = await getAccessToken(config);
    console.log(green("  ✓ Authenticated!\n"));
  } catch (err) {
    console.log(red(`\n  Authentication failed: ${err.message}`));
    const { reconfigure } = await inquirer.prompt([
      { type: "confirm", name: "reconfigure", message: "Reconfigure credentials?", default: true },
    ]);
    if (reconfigure) {
      config = await setupConfig();
      token = await getAccessToken(config);
    } else {
      return;
    }
  }

  let running = true;

  while (running) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What do you want to do?",
        choices: [
          { name: "📬  Read emails       — view recent messages", value: "read" },
          { name: "🔍  Search emails     — find by subject/sender/content", value: "search" },
          { name: "📊  Summarize inbox   — stats and highlights", value: "summarize" },
          { name: "✉️   Send email        — compose and send", value: "send" },
          new inquirer.Separator(),
          { name: "⚙️   Reconfigure       — update credentials", value: "reconfig" },
          { name: "👋  Exit", value: "exit" },
        ],
      },
    ]);

    try {
      switch (action) {
        case "read":
          await readEmails(token);
          break;
        case "search":
          await searchEmails(token);
          break;
        case "summarize":
          await summarizeEmails(token);
          break;
        case "send":
          await sendEmail(token);
          break;
        case "reconfig":
          config = await setupConfig();
          token = await getAccessToken(config);
          console.log(green("  ✓ Re-authenticated!\n"));
          break;
        case "exit":
          running = false;
          console.log(green("\n  Bye!\n"));
          break;
      }
    } catch (err) {
      console.log(red(`\n  Error: ${err.message}\n`));

      if (err.message.includes("401") || err.message.includes("token")) {
        console.log(yellow("  Token may have expired. Re-authenticating..."));
        try {
          token = await getAccessToken(config);
          console.log(green("  ✓ Re-authenticated!\n"));
        } catch {
          console.log(red("  Failed to re-authenticate. Try reconfiguring.\n"));
        }
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
