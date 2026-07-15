import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

type AuthResult = { error: string | null };

type AuthValue = {
  user: User | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
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

  const signUp: AuthValue["signUp"] = async (email, password) => {
    if (!supabase) {
      if (!email || password.length < 6) return { error: "Enter an email and a password of at least 6 characters." };
      try { localStorage.setItem(DEMO_KEY, email); } catch { /* ignore */ }
      setUser(demoUser(email));
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut: AuthValue["signOut"] = async () => {
    if (!supabase) {
      try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, demoMode: !isSupabaseConfigured, signIn, signUp, signOut }}>
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
