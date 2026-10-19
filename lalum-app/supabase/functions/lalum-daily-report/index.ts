import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The pg_cron job passes ?k=<key>. The key lives in the database (lalum_private.report_keys) and is checked
// through lalum_verify_report_key; it is never stored in this source.
// Registrations are counted only when the email is confirmed; unconfirmed attempts and visitors who tried the
// chat without registering are reported apart (lalum_login_report, 2026-10-19).

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: keyOk } = await supa.rpc("lalum_verify_report_key", { p_key: url.searchParams.get("k") ?? "" });
  if (keyOk !== true) {
    return new Response("forbidden", { status: 403 });
  }

  const { data, error } = await supa.rpc("lalum_login_report");
  if (error) {
    return new Response("db error: " + error.message, { status: 500 });
  }

  const r = data as {
    date: string;
    total_users: number;
    registrations_today: number;
    unconfirmed_today?: number;
    anonymous_chat_attempts_today?: number;
    active_today: number;
    logins: { email: string; at: string }[];
  };

  // Idempotency: claim today's report date before sending. If it is already
  // claimed, a duplicate/retried invocation already sent it, so skip. This
  // guarantees the report goes out at most once per day.
  const claim = await supa.from("lalum_report_log").insert({ sent_date: r.date });
  if (claim.error) {
    if ((claim.error as { code?: string }).code === "23505") {
      return new Response(
        JSON.stringify({ ok: true, skipped: "already_sent_today", date: r.date }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Any other error: fall through and still send so a report is not lost.
  }

  const lines: string[] = [];
  lines.push(`📊 דוח כניסות LALUM · ${r.date}`);
  lines.push("");
  lines.push(`כניסות היום (משתמשים פעילים): ${r.active_today}`);
  lines.push(`הרשמות שהושלמו היום: ${r.registrations_today}`);
  lines.push(`ניסיונות הרשמה שלא אושרו (דוא״ל לא אומת): ${r.unconfirmed_today ?? 0}`);
  lines.push(`ניסיונות צ׳אט ללא הרשמה: ${r.anonymous_chat_attempts_today ?? 0}`);
  lines.push(`סה״כ משתמשים: ${r.total_users}`);
  if (Array.isArray(r.logins) && r.logins.length) {
    lines.push("");
    lines.push("פירוט כניסות:");
    for (const l of r.logins) lines.push(`• ${l.at} · ${l.email}`);
  } else {
    lines.push("");
    lines.push("אין כניסות היום.");
  }
  const text = lines.join("\n");

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    // Nothing sent: release the claim so a correctly-configured retry can send.
    await supa.from("lalum_report_log").delete().eq("sent_date", r.date);
    return new Response(JSON.stringify({ ok: false, reason: "telegram secrets not set" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const ok = tg.ok;
  const body = await tg.text();
  if (!ok) {
    // Send failed: release the claim so a retry can try again.
    await supa.from("lalum_report_log").delete().eq("sent_date", r.date);
  }
  return new Response(JSON.stringify({ ok, telegram: body }), {
    status: ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
