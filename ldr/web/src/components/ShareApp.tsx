import { useState } from "react";
import type { Profile } from "../lib/supabase";
import { Wordmark } from "./Logo";

// ── Share LAWDin + copyable "member of LAWDin" signature ────────────────────
// A share sheet (native share / copy link / WhatsApp / Telegram / Email) plus a
// ready signature block (logo + "חבר/ה ב-LAWDin") the user can copy into email.

export default function ShareApp({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const [copied, setCopied] = useState<"" | "link" | "sig">("");
  const url = window.location.origin;
  const name = profile?.display_name || "עו״ד";
  const shareText = `הצטרפו אליי ל-LAWDin, רשת עורכי הדין והבית המקצועי להתחדשות עירונית: ${url}`;

  const sigText = `${name}\nחבר/ה ב-LAWDin · רשת עורכי הדין וההתחדשות העירונית\n${url}`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const sigHtml =
    `<div dir="rtl" style="font-family:Arial,sans-serif;color:#1B1B1B;line-height:1.5;text-align:right">` +
    `<div style="font-weight:900;font-size:18px;letter-spacing:.5px">LAW<span style="background:#1ba3e0;color:#fff;padding:0 5px;border-radius:5px">din</span></div>` +
    `<div style="font-weight:700;margin-top:4px">${esc(name)}</div>` +
    `<div style="color:#555;font-size:13px">חבר/ה ב-LAWDin · רשת עורכי הדין וההתחדשות העירונית</div>` +
    `<a href="${url}" style="color:#1ba3e0;font-size:13px">${url}</a></div>`;

  async function shareApp() {
    if (navigator.share) {
      try { await navigator.share({ title: "LAWDin", text: shareText, url }); return; } catch { /* cancelled */ }
    }
    copy(shareText, "link");
  }
  function copy(text: string, which: "link" | "sig") {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(""), 1800);
  }
  async function copySignature() {
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([new (window as any).ClipboardItem({
          "text/html": new Blob([sigHtml], { type: "text/html" }),
          "text/plain": new Blob([sigText], { type: "text/plain" }),
        })]);
        setCopied("sig"); setTimeout(() => setCopied(""), 1800); return;
      }
    } catch { /* fall back to plain text */ }
    copy(sigText, "sig");
  }

  const enc = encodeURIComponent(shareText);
  const QUICK = [
    { label: "WhatsApp", icon: "💬", href: `https://wa.me/?text=${enc}` },
    { label: "Telegram", icon: "✈️", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("הצטרפו אליי ל-LAWDin")}` },
    { label: "Email", icon: "✉️", href: `mailto:?subject=${encodeURIComponent("הצטרפו ל-LAWDin")}&body=${enc}` },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" dir="rtl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>שיתוף LAWDin</h3>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onClose}>✕</button>
        </div>

        {/* Share the app */}
        <button className="btn btn-gold" style={{ width: "100%" }} onClick={shareApp}>
          📤 שתף את האפליקציה
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {QUICK.map((q) => (
            <a key={q.label} href={q.href} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost" style={{ flex: 1, textAlign: "center", fontSize: 13 }}>
              {q.icon} {q.label}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <input readOnly value={url} dir="ltr" style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => copy(url, "link")}>
            {copied === "link" ? "✓ הועתק" : "העתק קישור"}
          </button>
        </div>

        {/* QR for quick mobile sharing */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <div style={{ background: "#fff", padding: 10, borderRadius: 14, textAlign: "center" }}>
            <img alt="QR לשיתוף LAWDin" width={148} height={148}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=148x148&margin=0&data=${encodeURIComponent(url)}`} />
            <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>סרקו לפתיחת LAWDin</div>
          </div>
        </div>

        <div className="divider" style={{ margin: "18px 0" }} />

        {/* Signature block */}
        <label style={{ marginBottom: 8 }}>החתימה שלי (להעתקה לאימייל)</label>
        <div style={{ background: "#fff", color: "#1B1B1B", borderRadius: 12, padding: 14, textAlign: "right" }}>
          <Wordmark size={30} tone="light" tagline={false} />
          <div style={{ fontWeight: 700, marginTop: 6 }}>{name}</div>
          <div style={{ fontSize: 13, color: "#555" }}>חבר/ה ב-LAWDin · רשת עורכי הדין וההתחדשות העירונית</div>
          <a href={url} dir="ltr" style={{ fontSize: 13, color: "#1ba3e0" }}>{url}</a>
        </div>
        <button className="btn btn-gold" style={{ width: "100%", marginTop: 12 }} onClick={copySignature}>
          {copied === "sig" ? "✓ החתימה הועתקה" : "📋 העתק חתימה"}
        </button>
      </div>
    </div>
  );
}
