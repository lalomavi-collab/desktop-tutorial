import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useLang } from "../context/LangContext";
import { evaluatePassword, type PasswordRules } from "../lib/passwordPolicy";
import { generateStrongPassword } from "../lib/strongPassword";

// One password input for every place a password is typed: a show/hide control,
// a Caps Lock warning, and, when a NEW password is being chosen, a strength
// meter with the rules it is judged by and an optional generator.
//
// Protections that are deliberate:
//  - A revealed password hides again by itself after 20 seconds, when the window
//    loses focus, when the tab is hidden, and when the form is submitted, so it is
//    not left on screen if the person walks away or shares a screen.
//  - The input never trims, rewrites or truncates what is typed or pasted. Pasting
//    stays allowed: it is how password managers fill the field.
//  - Spell check, autocorrect and auto capitalisation are off, so the browser does
//    not send the text to a spelling service or alter it.
//  - The strength rules apply only when `showStrength` is set (a new password). Sign
//    in shows the toggle alone, so a password set under an older rule still works.

const AUTO_HIDE_MS = 20_000;
const LEVEL_COLORS = ["#b3261e", "#c2410c", "#a16207", "#2e7d32", "#1b5e20"];

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  /** Judge the value as a new password: meter, rules and the tip. */
  showStrength?: boolean;
  /** Offer a generated password (new passwords only). */
  generate?: boolean;
  /** Facts about the account, so a password built from them is flagged. */
  context?: { email?: string; name?: string };
  /** Shown while nothing is typed yet. */
  hint?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Extra content on the label row, after the generate control. */
  labelExtra?: ReactNode;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, required, showStrength, generate, context, hint, invalid, autoFocus, placeholder, labelExtra }: Props) {
  const { t } = useLang();
  const L = t.ui.login;
  const W = t.ui.pw;
  const autoId = useId();
  const fieldId = id ?? `pw-${autoId}`;
  const [revealed, setRevealed] = useState(false);
  const [caps, setCaps] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hide again on a timer, on losing the window or tab, and on submit.
  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(false);
    const timer = window.setTimeout(hide, AUTO_HIDE_MS);
    const onVisibility = () => { if (document.visibilityState === "hidden") hide(); };
    const form = inputRef.current?.form ?? null;
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);
    form?.addEventListener("submit", hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      form?.removeEventListener("submit", hide);
    };
  }, [revealed]);

  const email = context?.email;
  const name = context?.name;
  const report = useMemo(
    () => (showStrength ? evaluatePassword(value, { email, name }, { generated: generated !== null && generated === value }) : null),
    [showStrength, value, email, name, generated],
  );

  function onGenerate() {
    const pw = generateStrongPassword();
    setGenerated(pw);
    onChange(pw);
    setRevealed(true);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyLabel(L.copiedPassword);
      window.setTimeout(() => setCopyLabel(null), 1500);
    } catch { /* clipboard unavailable; the field is still selectable */ }
  }

  const rules: { key: keyof PasswordRules; text: string }[] = [
    { key: "length", text: W.ruleLength },
    { key: "notCommon", text: W.ruleNotCommon },
    { key: "notPersonal", text: W.rulePersonal },
    { key: "noPattern", text: W.rulePattern },
    { key: "withinMax", text: W.ruleMax },
  ];
  const hasValue = value.length > 0;

  return (
    <div>
      <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <label htmlFor={fieldId}>{label}</label>
        <span style={{ display: "inline-flex", gap: 12, alignItems: "baseline" }}>
          {generate && (
            <button type="button" onClick={onGenerate} style={{ background: "none", border: 0, color: "var(--clay)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>
              {L.generatePassword}
            </button>
          )}
          {labelExtra}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            id={fieldId}
            ref={inputRef}
            className="field"
            type={revealed ? "text" : "password"}
            autoComplete={autoComplete}
            required={required}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
            onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
            onBlur={() => setCaps(false)}
            placeholder={placeholder}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={invalid || undefined}
            aria-describedby={showStrength ? `${fieldId}-help` : undefined}
            style={{ width: "100%", paddingRight: 46 }}
          />
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-controls={fieldId}
            aria-label={revealed ? W.hide : W.show}
            title={revealed ? W.hide : W.show}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, cursor: "pointer", color: "var(--slate)", width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 6 }}
          >
            <EyeIcon off={revealed} />
          </button>
        </div>
        {generate && revealed && hasValue && (
          <button type="button" className="btn" onClick={() => void onCopy()} style={{ flexShrink: 0 }}>
            {copyLabel ?? L.copyPassword}
          </button>
        )}
      </div>

      {caps && <p role="status" style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--clay)", fontWeight: 600 }}>{W.capsOn}</p>}

      {showStrength && report && (
        <div id={`${fieldId}-help`} style={{ marginTop: 8 }}>
          {!hasValue ? (
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{hint ?? W.hint12}</p>
          ) : (
            <>
              <div role="meter" aria-label={W.strength} aria-valuemin={0} aria-valuemax={4} aria-valuenow={report.score} aria-valuetext={W.levels[report.score]} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ height: 5, borderRadius: 3, background: report.score > i || (report.score === 4) ? LEVEL_COLORS[report.score] : "var(--line)" }} />
                ))}
              </div>
              <p aria-live="polite" style={{ fontSize: 13, margin: "6px 0 0", fontWeight: 600 }}>
                {W.strength}: {W.levels[report.score]}
              </p>
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, fontSize: 12.5, lineHeight: 1.7 }}>
                {rules.map((r) => {
                  const met = report.rules[r.key];
                  return (
                    <li key={r.key} style={{ display: "flex", gap: 6, color: met ? "var(--ink)" : "var(--slate)" }}>
                      <span aria-hidden="true" style={{ width: 14, fontWeight: 700, color: met ? "#2e7d32" : "var(--slate)" }}>{met ? "✓" : "○"}</span>
                      <span>{r.text}</span>
                    </li>
                  );
                })}
              </ul>
              {report.ok && report.score < 2 && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{W.longer}</p>}
              {!report.ok && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>{W.tip}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
