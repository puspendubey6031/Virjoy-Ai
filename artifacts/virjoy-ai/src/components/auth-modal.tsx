import { useState, useEffect, useContext, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { OTPInput, OTPInputContext } from "input-otp";
import type { ConfirmationResult } from "firebase/auth";

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
  Sparkles, Mail, Lock, Eye, EyeOff, Phone,
  ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  AlertTriangle, ShieldCheck,
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

const phoneSchema = z.object({
  phone: z
    .string()
    .min(10, "Include country code")
    .regex(/^\+/, "Start with country code, e.g. +91"),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;
type PhoneForm = z.infer<typeof phoneSchema>;

// ── OTP Slot ──────────────────────────────────────────────────────────────────
function OTPSlot({ index }: { index: number }) {
  const ctx = useContext(OTPInputContext);
  const slot = ctx.slots[index]!;
  return (
    <div
      className={`w-11 h-13 flex items-center justify-center text-xl font-bold rounded-xl border-2 transition-all duration-200 bg-white/5 ${
        slot.isActive
          ? "border-primary shadow-md shadow-primary/20 text-white"
          : slot.char
          ? "border-primary/40 text-white"
          : "border-white/15 text-white/30"
      }`}
      style={{ minHeight: 52 }}
    >
      {slot.char ?? <span className="w-1.5 h-0.5 bg-white/20 rounded" />}
    </div>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────────
function SignupStepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-4">
      {[1, 2, 3].map((s) => (
        <motion.div
          key={s}
          animate={{
            width: step === s ? 20 : 6,
            backgroundColor:
              step === s ? "hsl(var(--primary))" : step > s ? "hsl(var(--primary)/0.4)" : "rgba(255,255,255,0.15)",
          }}
          transition={{ duration: 0.25 }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  defaultTab?: "login" | "signup";
  onClose: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function AuthModal({ open, defaultTab = "login", onClose }: AuthModalProps) {
  const { signUpWithEmail, signInWithEmail, sendPhoneOTP, confirmOTPAndLink, isConfigured } = useAuth();
  const { toast } = useToast();

  // Tab state — reset when modal opens
  const [tab, setTab] = useState<"login" | "signup">(defaultTab);
  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  // Login state
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupStep, setSignupStep] = useState(1);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  // Reset signup when tab or modal open/close changes
  useEffect(() => {
    if (!open || tab !== "signup") {
      setSignupStep(1);
      setOtp("");
      setConfirmation(null);
    }
  }, [open, tab]);

  // Forms
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });
  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) });

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (data: LoginForm) => {
    setLoginLoading(true);
    try {
      const dbUser = await signInWithEmail(data.email, data.password);
      toast({ title: "Welcome back!", description: `Signed in as ${dbUser.email}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Sign in failed", description: firebaseMsg(err.code, "login"), variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Signup step 1 ──────────────────────────────────────────────────────────
  const handleSignupEmail = async (data: SignupForm) => {
    setSignupLoading(true);
    try {
      await signUpWithEmail(data.email, data.password);
      setSignupStep(2);
    } catch (err: any) {
      toast({ title: "Sign up failed", description: firebaseMsg(err.code, "signup"), variant: "destructive" });
    } finally {
      setSignupLoading(false);
    }
  };

  // ── Signup step 2 ──────────────────────────────────────────────────────────
  const handleSendOTP = async (data: PhoneForm) => {
    setSignupLoading(true);
    try {
      const result = await sendPhoneOTP(data.phone, "auth-modal-recaptcha");
      setConfirmation(result);
      setSignupStep(3);
      toast({ title: "OTP sent", description: `Code sent to ${data.phone}` });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: firebaseMsg(err.code, "phone"), variant: "destructive" });
    } finally {
      setSignupLoading(false);
    }
  };

  // ── Signup step 3 ──────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (otp.length !== 6 || !confirmation) return;
    setSignupLoading(true);
    try {
      const dbUser = await confirmOTPAndLink(confirmation, otp);
      toast({
        title: "Account created!",
        description: `Welcome to VirJoy AI — you have ${dbUser.credits} free credits.`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: "Verification failed", description: firebaseMsg(err.code, "otp"), variant: "destructive" });
      setOtp("");
    } finally {
      setSignupLoading(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6) handleVerifyOTP();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10 text-white shadow-2xl p-0 overflow-hidden">
        {/* Invisible reCAPTCHA container */}
        <div id="auth-modal-recaptcha" ref={recaptchaRef} className="hidden" />

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

        {/* Firebase config warning */}
        {!isConfigured && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Firebase not configured</p>
              <p className="text-amber-400/70 mt-0.5 text-xs">
                Add <code className="text-amber-300">VITE_FIREBASE_*</code> secrets to Replit to enable auth.
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
                <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Password</Label>
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
            <SignupStepDots step={signupStep} />

            <AnimatePresence mode="wait">
              {/* Step 1 — Email + password */}
              {signupStep === 1 && (
                <motion.form key="s1"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
                  onSubmit={signupForm.handleSubmit(handleSignupEmail)} className="space-y-3">

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
                      <span className="flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </Button>

                  <p className="text-center text-xs text-white/30 mt-2">
                    Phone verification required after this step
                  </p>
                </motion.form>
              )}

              {/* Step 2 — Phone number */}
              {signupStep === 2 && (
                <motion.form key="s2"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
                  onSubmit={phoneForm.handleSubmit(handleSendOTP)} className="space-y-4">

                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-white/60">
                    <p className="font-semibold text-white/80 mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Phone verification
                    </p>
                    Links your phone to prevent duplicate accounts and secures your credits.
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Mobile number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <Input {...phoneForm.register("phone")} type="tel" autoComplete="tel"
                        placeholder="+91 9876543210"
                        className="pl-9 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50" />
                    </div>
                    {phoneForm.formState.errors.phone && (
                      <p className="text-red-400/80 text-xs">{phoneForm.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={signupLoading}
                    className="w-full h-11 bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-primary/20">
                    {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <span className="flex items-center gap-2">Send OTP <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </Button>
                </motion.form>
              )}

              {/* Step 3 — OTP */}
              {signupStep === 3 && (
                <motion.div key="s3"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
                  className="space-y-5">

                  <p className="text-center text-white/50 text-sm">
                    Enter the 6-digit code sent to your phone
                  </p>

                  <div className="flex justify-center">
                    <OTPInput maxLength={6} value={otp} onChange={setOtp}
                      containerClassName="flex gap-2"
                      render={({ slots }) => (
                        <>{slots.map((_, i) => <OTPSlot key={i} index={i} />)}</>
                      )} />
                  </div>

                  <Button onClick={handleVerifyOTP} disabled={signupLoading || otp.length !== 6}
                    className="w-full h-11 bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 disabled:opacity-40">
                    {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Verify & Create Account
                      </span>
                    )}
                  </Button>

                  <button type="button" onClick={() => { setSignupStep(2); setOtp(""); setConfirmation(null); }}
                    className="w-full text-center text-xs text-white/35 hover:text-white/60 transition-colors flex items-center justify-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Change phone number
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Error messages ────────────────────────────────────────────────────────────
function firebaseMsg(code?: string, context?: "login" | "signup" | "phone" | "otp"): string {
  if (context === "login") {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "Incorrect email or password.";
      case "auth/too-many-requests": return "Too many attempts. Please wait and try again.";
      case "auth/user-disabled": return "This account has been disabled.";
      default: return "Sign in failed. Please try again.";
    }
  }
  if (context === "signup") {
    switch (code) {
      case "auth/email-already-in-use": return "An account with this email already exists.";
      case "auth/weak-password": return "Password is too weak. Use at least 8 characters.";
      default: return "Sign up failed. Please try again.";
    }
  }
  if (context === "phone") {
    switch (code) {
      case "auth/invalid-phone-number": return "Invalid phone number. Include country code.";
      case "auth/too-many-requests": return "Too many OTP requests. Please wait.";
      default: return "Could not send OTP. Check the number and try again.";
    }
  }
  if (context === "otp") {
    switch (code) {
      case "auth/invalid-verification-code": return "Incorrect code. Re-enter the 6-digit OTP.";
      case "auth/code-expired": return "Code expired. Go back and request a new one.";
      default: return "Verification failed. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
