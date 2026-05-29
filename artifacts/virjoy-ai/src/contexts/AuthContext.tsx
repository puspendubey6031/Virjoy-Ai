import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type User as FirebaseUser,
  type ConfirmationResult,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  linkWithPhoneNumber,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

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

// ── Context type ──────────────────────────────────────────────────────────────
interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: DbUser | null;
  authLoading: boolean;
  /** True when Firebase env vars are set and the SDK is initialised. */
  isConfigured: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<DbUser>;
  signOut: () => Promise<void>;
  sendPhoneOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  confirmOTPAndLink: (confirmation: ConfirmationResult, otp: string) => Promise<DbUser>;
  refreshDbUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setDbUser(await fetchDbUser(token));
        } catch {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      setAuthLoading(false);
    });

    return unsub;
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured");
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<DbUser> => {
    if (!auth) throw new Error("Firebase is not configured");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken(true);
    // Sign-in only fetches the existing profile — it must NOT register/provision
    // an account. If no record exists, the user never finished phone verification.
    const backend = await fetchDbUser(token);
    if (!backend) {
      const err = new Error(
        "Please finish phone verification to activate your account.",
      ) as Error & { code?: string };
      err.code = "auth/registration-incomplete";
      throw err;
    }
    setDbUser(backend);
    return backend;
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setDbUser(null);
  }, []);

  const sendPhoneOTP = useCallback(
    async (phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> => {
      if (!auth) throw new Error("Firebase is not configured");
      if (!auth.currentUser) throw new Error("Sign in with email first");

      const existing = (window as any).__vrRecaptcha as RecaptchaVerifier | undefined;
      if (existing) { try { existing.clear(); } catch { /* ignore */ } }

      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: "invisible",
        callback: () => {},
      });
      (window as any).__vrRecaptcha = verifier;

      return linkWithPhoneNumber(auth.currentUser, phoneNumber, verifier);
    },
    [],
  );

  const confirmOTPAndLink = useCallback(
    async (confirmation: ConfirmationResult, otp: string): Promise<DbUser> => {
      const result = await confirmation.confirm(otp);
      const token = await result.user.getIdToken(true);
      const backend = await syncWithBackend(token);
      setDbUser(backend);
      return backend;
    },
    [],
  );

  const refreshDbUser = useCallback(async () => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    setDbUser(await fetchDbUser(token));
  }, [firebaseUser]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        authLoading,
        isConfigured: isFirebaseConfigured,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        sendPhoneOTP,
        confirmOTPAndLink,
        refreshDbUser,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
