import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { createVerifierClient, supabase } from "../lib/supabase";
import { pwnedCount } from "../lib/pwnedCheck";
import { evaluatePassword } from "../lib/passwordPolicy";
import { PasswordField } from "./PasswordField";

// Change the password of the signed in user.
//
// Protections, in the order they apply:
//  1. The new password must meet the policy (length, not common, not built from the account's
//     own details, no pattern, within bcrypt's 72 bytes) and must differ from the current one.
//  2. It is checked against known breaches (k-anonymity: only 5 characters of its hash leave).
//  3. The CURRENT password is verified on the server through a throwaway client, so a stolen
//     but unlocked session cannot change the password without knowing it.
//  4. Wrong current passwords slow down: three misses lock the form for 30 seconds, doubling
//     up to 15 minutes. The count survives a reload (sessionStorage); the server's own rate
//     limit is the backstop for anyone who bypasses this page.
//  5. After the change every OTHER session is signed out, so a session someone else holds is
//     cut off. The current one stays.
// An account with a second factor is wrapped by the page that hosts this (MfaGate); if the
// server still asks for it, the message says to confirm the code first.

const KEY = "lalum_pw_attempts";
const FREE_ATTEMPTS = 3;
const BASE_LOCK_S = 30;
const MAX_LOCK_S = 15 * 60;

interface Attempts { n: number; until: number }

function loadAttempts(): Attempts {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      const a = JSON.parse(raw) as Attempts;
      if (typeof a.n === "number" && typeof a.until === "number") return a;
    }
  } catch { /* storage blocked: start clean */ }
  return { n: 0, until: 0 };
}

function saveAttempts(a: Attempts) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

function lockSeconds(n: number): number {
  if (n < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_LOCK_S, BASE_LOCK_S * 2 ** (n - FREE_ATTEMPTS));
}

export function ChangePassword({ onChanged }: { onChanged?: () => void }) {
  const { user, updatePassword, demoMode } = useAuth();
  const { t } = useLang();
  const W = t.ui.pw;
  const L = t.ui.login;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<Attempts>(loadAttempts);
  const [now, setNow] = useState(() => Date.now());

  const lockedFor = Math.max(0, Math.ceil((attempts.until - now) / 1000));
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockedFor]);

  // Do not leave typed passwords in memory once the panel is gone.
  useEffect(() => () => { setCurrent(""); setNext(""); setConfirm(""); }, []);

  const email = user?.email ?? undefined;
  const mismatch = confirm.length > 0 && confirm !== next;

  function fail(a: Attempts) {
    setAttempts(a);
    saveAttempts(a);
    setNow(Date.now());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (lockedFor > 0) { setError(W.tooMany.replace("{s}", String(lockedFor))); return; }
    if (!evaluatePassword(next, { email }).ok) { setError(W.policyFailed); return; }
    if (next !== confirm) { setError(W.mismatch); return; }
    if (next === current) { setError(W.sameAsCurrent); return; }

    setBusy(true);
    try {
      if (!demoMode) {
        if ((await pwnedCount(next)) > 0) { setError(L.leakedPassword); return; }

        // Verify the current password without disturbing this session.
        const verifier = createVerifierClient();
        if (verifier && email) {
          const { error: signInError } = await verifier.auth.signInWithPassword({ email, password: current });
          await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
          if (signInError) {
            if (signInError.status === 429) { setError(W.rateLimited); return; }
            const n = attempts.n + 1;
            const secs = lockSeconds(n);
            fail({ n, until: secs > 0 ? Date.now() + secs * 1000 : 0 });
            setError(secs > 0 ? W.tooMany.replace("{s}", String(secs)) : W.wrongCurrent);
            return;
          }
        }
      }

      const res = await updatePassword(next, current);
      if (res.error) {
        setError(/aal2/i.test(res.error) ? W.needMfa : res.error);
        return;
      }

      // Cut off every other session; this one stays.
      let others = true;
      if (supabase) {
        const { error: outError } = await supabase.auth.signOut({ scope: "others" });
        others = !outError;
      }
      fail({ n: 0, until: 0 });
      setCurrent(""); setNext(""); setConfirm("");
      setDone(others ? W.changed : W.changedKept);
      onChanged?.();
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  // After a change the form gives way to the confirmation, so it cannot be missed and the old
  // password is not typed again into a form that no longer accepts it.
  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="notice notice-ok" role="status">{done}</div>
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setDone(null)}>{W.changeAgain}</button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }} autoComplete="on" noValidate>
      {/* Lets a password manager tie the new password to this account. */}
      <input type="text" name="username" autoComplete="username" value={email ?? ""} readOnly aria-hidden="true" tabIndex={-1} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>{W.changeIntro}</p>
      {error && <div className="notice notice-err" role="alert">{error}</div>}
      <PasswordField id="pw-current" label={W.current} value={current} onChange={setCurrent} autoComplete="current-password" required />
      <PasswordField id="pw-new" label={W.newLabel} value={next} onChange={setNext} autoComplete="new-password" required showStrength generate context={{ email }} />
      <div>
        <PasswordField id="pw-confirm" label={W.confirm} value={confirm} onChange={setConfirm} autoComplete="new-password" required invalid={mismatch} />
        {mismatch && <p role="alert" style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--clay)", fontWeight: 600 }}>{W.mismatch}</p>}
      </div>
      <button className="btn btn-clay" style={{ justifyContent: "center" }} disabled={busy || lockedFor > 0 || !current || !next || !confirm}>
        {busy ? L.pleaseWait : lockedFor > 0 ? W.tooMany.replace("{s}", String(lockedFor)) : W.changeSubmit}
      </button>
    </form>
  );
}
