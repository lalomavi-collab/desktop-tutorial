import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type AuthResult = { error: string | null; needsConfirmation?: boolean };

type AuthValue = {
  user: User | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, leadLang?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  verifyRecoveryCode: (email: string, code: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthValue | null>(null);

const DEMO_KEY = "lalum_demo_user";

// A minimal shape that satisfies the parts of `User` the UI reads.
function demoUser(email: string): User {
  return { id: "demo-" + email, email, app_metadata: {}, user_metadata: {}, aud: "demo", created_at: new Date(0).toISOString() } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // Demo mode: restore a locally stored session, if any.
      try {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) setUser(demoUser(saved));
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const u = session?.user;
      const meta = (u?.user_metadata ?? {}) as { lead_pending?: boolean; lead_consent?: boolean; lead_lang?: string };
      // A completed registration: a confirmed email with a live session and a sign-up that has not been reported yet.
      // Run outside the callback (supabase-js can deadlock when the callback awaits its own client).
      if (u && u.email_confirmed_at && meta.lead_pending && meta.lead_consent) {
        setTimeout(() => {
          void supabase!.functions.invoke("lalum-lead-submit", {
            body: { name: (u.email ?? "").split("@")[0], email: u.email, consent: true, source: "signup", interest: "ai-governance", lang: meta.lead_lang ?? "he" },
          }).then(({ error }: { error: unknown }) => {
            if (!error) void supabase!.auth.updateUser({ data: { lead_pending: false } });
          }).catch(() => undefined);
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthValue["signIn"] = async (email, password) => {
    if (!supabase) {
      if (!email || password.length < 6) return { error: "Enter an email and a password of at least 6 characters." };
      try { localStorage.setItem(DEMO_KEY, email); } catch { /* ignore */ }
      setUser(demoUser(email));
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthValue["signUp"] = async (email, password, leadLang) => {
    if (!supabase) {
      if (!email || password.length < 6) return { error: "Enter an email and a password of at least 6 characters." };
      try { localStorage.setItem(DEMO_KEY, email); } catch { /* ignore */ }
      setUser(demoUser(email));
      return { error: null, needsConfirmation: false };
    }
    // The sign-up carries its consent and language in the user's metadata. The firm is told about the
    // registration only once it is complete (first signed-in session after the email is confirmed), see below.
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { lead_pending: true, lead_consent: true, lead_lang: leadLang ?? "he" } } });
    if (error) return { error: error.message };
    // When email confirmation is off, signUp returns a live session and the
    // user is already signed in; otherwise they must confirm by email first.
    return { error: null, needsConfirmation: !data.session };
  };

  const signOut: AuthValue["signOut"] = async () => {
    if (!supabase) {
      try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const resetPassword: AuthValue["resetPassword"] = async (email) => {
    if (!supabase) return { error: null };
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  };

  // The same reset email also carries a one-time code ({{ .Token }} in the
  // Supabase "Reset Password" template), for a visitor who would rather type
  // a code than follow a link. Verifying it establishes the same recovery
  // session a clicked link would (fires PASSWORD_RECOVERY), so everything
  // downstream (the MFA gate, the new-password form) stays the one path.
  const verifyRecoveryCode: AuthValue["verifyRecoveryCode"] = async (email, code) => {
    // Digits only: a code copied out of the email can carry spaces or invisible direction marks.
    const token = code.replace(/\D/g, "");
    if (!supabase) {
      if (token.length < 6) return { error: "Enter the code from the email." };
      return { error: null };
    }
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "recovery" });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthValue["updatePassword"] = async (password) => {
    if (!supabase) {
      if (password.length < 6) return { error: "Enter a password of at least 6 characters." };
      return { error: null };
    }
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, loading, demoMode: !isSupabaseConfigured, signIn, signUp, signOut, resetPassword, verifyRecoveryCode, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
