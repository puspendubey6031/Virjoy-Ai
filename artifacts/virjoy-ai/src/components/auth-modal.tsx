import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles, Mail, Lock, Eye, EyeOff,
  ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";

// ── Schemas ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Include one uppercase letter")
      .regex(/[0-9]/, "Include one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  defaultTab?: "login" | "signup";
  onClose: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function AuthModal({ open, defaultTab = "login", onClose }: AuthModalProps) {
  const { signUpWithEmail, signInWithEmail, sendPasswordReset, isConfigured } = useAuth();
  const { toast } = useToast();

  // Tab state — reset when modal opens
  const [tab, setTab] = useState<"login" | "signup">(defaultTab);
  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  // Login state
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Signup state
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  // Forms
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  // ── Forgot password ─────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const email = loginForm.getValues("email")?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Enter your email first",
        description: "Type your account email above, then tap “Forgot password?”.",
        variant: "destructive",
      });
      return;
    }
    setResetting(true);
    try {
      await sendPasswordReset(email);
      toast({ title: "Reset link sent", description: "Check your inbox to set a new password." });
    } catch (err: any) {
      toast({ title: "Couldn't send reset email", description: authMsg(err), variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (data: LoginForm) => {
    setLoginLoading(true);
    try {
      const dbUser = await signInWithEmail(data.email, data.password);
      toast({ title: "Welcome back!", description: `Signed in as ${dbUser.email}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Sign in failed", description: authMsg(err), variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Signup ─────────────────────────────────────────────────────────────────
  const handleSignup = async (data: SignupForm) => {
    setSignupLoading(true);
    try {
      const result = await signUpWithEmail(data.email, data.password);
      if (result.needsConfirmation) {
        toast({
          title: "Check your email",
          description: "We sent a confirmation link. Confirm it, then sign in.",
        });
        setTab("login");
        return;
      }
      toast({
        title: "Account created!",
        description: `Welcome to VirJoy AI — you have ${result.dbUser?.credits ?? 0} free credits.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: "Sign up failed", description: authMsg(err), variant: "destructive" });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10 text-white shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              VirJoy AI
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Auth config warning */}
        {!isConfigured && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Authentication not configured</p>
              <p className="text-amber-400/70 mt-0.5 text-xs">
                Add <code className="text-amber-300">VITE_SUPABASE_URL</code> and <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> secrets to enable auth.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")} className="px-6 pb-6 pt-4">
          <TabsList className="w-full bg-white/5 border border-white/10 rounded-xl p-1 mb-5">
            <TabsTrigger
              value="login"
              className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 transition-all"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/80 data-[state=active]:to-cyan-500/80 data-[state=active]:text-white text-white/50 transition-all"
            >
              Create Account
            </TabsTrigger>
          </TabsList>

          {/* ── LOGIN TAB ───────────────────────────────────────────────── */}
          <TabsContent value="login" className="mt-0">
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input
                    {...loginForm.register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={!isConfigured}
                    className="pl-9 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/15 disabled:opacity-40"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-red-400/80 text-xs">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Password</Label>
                  <button type="button" onClick={handleForgotPassword} disabled={resetting || !isConfigured}
                    className="text-xs text-primary/80 hover:text-primary transition-colors disabled:opacity-40 normal-case tracking-normal">
                    {resetting ? "Sending…" : "Forgot password?"}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input
                    {...loginForm.register("password")}
                    type={showLoginPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={!isConfigured}
                    className="pl-9 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/15 disabled:opacity-40"
                  />
                  <button type="button" onClick={() => setShowLoginPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-red-400/80 text-xs">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loginLoading || !isConfigured}
                className="w-full h-11 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-40 mt-1">
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── SIGNUP TAB ──────────────────────────────────────────────── */}
          <TabsContent value="signup" className="mt-0">
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input {...signupForm.register("email")} type="email" autoComplete="email"
                    placeholder="you@example.com" disabled={!isConfigured}
                    className="pl-9 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 disabled:opacity-40" />
                </div>
                {signupForm.formState.errors.email && (
                  <p className="text-red-400/80 text-xs">{signupForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input {...signupForm.register("password")} type={showSignupPw ? "text" : "password"}
                    autoComplete="new-password" placeholder="Min 8 chars, 1 uppercase, 1 number"
                    disabled={!isConfigured}
                    className="pl-9 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 disabled:opacity-40" />
                  <button type="button" onClick={() => setShowSignupPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showSignupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-red-400/80 text-xs">{signupForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input {...signupForm.register("confirmPassword")} type={showConfirm ? "text" : "password"}
                    autoComplete="new-password" placeholder="Re-enter password" disabled={!isConfigured}
                    className="pl-9 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 disabled:opacity-40" />
                  <button type="button" onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-red-400/80 text-xs">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" disabled={signupLoading || !isConfigured}
                className="w-full h-11 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-40 mt-1">
                {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">Create Account <ArrowRight className="w-4 h-4" /></span>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Error messages ────────────────────────────────────────────────────────────
function authMsg(err?: any): string {
  const msg = (err?.message ?? "").toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Check your connection.";
  }
  return err?.message || "Something went wrong. Please try again.";
}
