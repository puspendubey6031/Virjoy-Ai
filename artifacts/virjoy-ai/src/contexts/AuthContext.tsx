import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Backend user shape ────────────────────────────────────────────────────────
export interface DbUser {
  id: number;
  email: string;
  mobileNumber: string | null;
  mobileVerified: boolean;
  username: string | null;
  currentPlan: string;
  credits: number;
  createdAt: string;
}

export interface SignUpResult {
  /** True when Supabase requires email confirmation before a session exists. */
  needsConfirmation: boolean;
  dbUser: DbUser | null;
}

// ── Context type ──────────────────────────────────────────────────────────────
interface AuthContextValue {
  /** The authenticated Supabase user, or null. */
  supabaseUser: SupabaseUser | null;
  dbUser: DbUser | null;
  authLoading: boolean;
  /** True when Supabase env vars are set and the client is initialised. */
  isConfigured: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<DbUser>;
  /** Send a password-reset email with a recovery link back to /reset-password. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Set a new password for the currently-authenticated (recovery) session. */
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshDbUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
  /** Change the account email; Supabase sends a confirmation email. */
  updateEmail: (newEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ── Backend helpers ───────────────────────────────────────────────────────────
function apiBase() {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

/** Provision-or-fetch the local user record from a Supabase access token. */
async function syncWithBackend(token: string): Promise<DbUser> {
  const res = await fetch(`${apiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Backend sync failed (${res.status})`);
  }
  return res.json() as Promise<DbUser>;
}

async function fetchDbUser(token: string): Promise<DbUser | null> {
  const res = await fetch(`${apiBase()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<DbUser>;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  // Attach the Supabase access token to all generated API client requests so
  // logged-in actions (e.g. video generation) are credited to the user.
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;
    setAuthTokenGetter(async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const applySession = async (session: Session | null) => {
      if (!active) return;
      setSupabaseUser(session?.user ?? null);
      if (session?.access_token) {
        try {
          // Ensure a local record exists, then surface the latest profile.
          const synced = await syncWithBackend(session.access_token).catch(() => null);
          setDbUser(synced ?? (await fetchDbUser(session.access_token)));
        } catch {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      setAuthLoading(false);
    };

    // onAuthStateChange fires immediately with an INITIAL_SESSION event, so we
    // rely on it alone — calling getSession() in parallel would trigger a
    // duplicate backend sync (and a race on first-time registration).
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      if (!supabase) throw new Error("Supabase is not configured");
      // With email confirmation enabled, Supabase sends a confirmation link.
      // Point it back at this app's login page so the user lands here after
      // confirming (otherwise it falls back to the project's Site URL).
      const base = import.meta.env.BASE_URL ?? "/";
      const emailRedirectTo = `${window.location.origin}${base}login`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) throw error;

      // When email confirmation is enabled, no session is returned until the
      // user confirms via email.
      if (!data.session) {
        return { needsConfirmation: true, dbUser: null };
      }

      const synced = await syncWithBackend(data.session.access_token);
      setDbUser(synced);
      return { needsConfirmation: false, dbUser: synced };
    },
    [],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<DbUser> => {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Sign in failed — no session returned");

      const synced = await syncWithBackend(data.session.access_token);
      setDbUser(synced);
      return synced;
    },
    [],
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase is not configured");
    const base = import.meta.env.BASE_URL ?? "/";
    const redirectTo = `${window.location.origin}${base}reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setDbUser(null);
  }, []);

  const refreshDbUser = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setDbUser(await fetchDbUser(token));
  }, [getToken]);

  const updateEmail = useCallback(async (newEmail: string) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        dbUser,
        authLoading,
        isConfigured: isSupabaseConfigured,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        updatePassword,
        signOut,
        refreshDbUser,
        getToken,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
