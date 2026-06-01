import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sparkles, Mail, Lock, Eye, EyeOff,
  ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ── Schema ────────────────────────────────────────────────────────────────────
const emailSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
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
type EmailForm = z.infer<typeof emailSchema>;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const [, navigate] = useLocation();

  const { signUpWithEmail, isConfigured } = useAuth();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const handleEmailSubmit = async (data: EmailForm) => {
    setLoading(true);
    try {
      const result = await signUpWithEmail(data.email, data.password);
      if (result.needsConfirmation) {
        toast({
          title: "Check your email",
          description: "We sent a confirmation link. Confirm it, then sign in.",
        });
        navigate("/login");
        return;
      }
      toast({
        title: "Account created!",
        description: `Welcome! You have ${result.dbUser?.credits ?? 0} free credits.`,
      });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign up failed", description: emailErrorMsg(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 pt-24 pb-12">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-cyan-500 flex items-center justify-center shadow-xl shadow-primary/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-black text-3xl tracking-tight bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              VirJoy AI
            </h1>
            <p className="text-white/50 text-sm mt-1">Start creating cinematic AI videos</p>
          </div>
        </div>

        {/* Config warning */}
        {!isConfigured && (
          <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Authentication not configured</p>
              <p className="text-amber-400/70 mt-0.5">
                Add your <code className="text-amber-300">VITE_SUPABASE_URL</code> and <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> secrets to enable sign-up.
              </p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white text-center mb-6">Create your account</h2>

          <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  {...emailForm.register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={!isConfigured}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 h-12 disabled:opacity-40"
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-red-400/80 text-xs">{emailForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  {...emailForm.register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  disabled={!isConfigured}
                  className="pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 h-12 disabled:opacity-40"
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {emailForm.formState.errors.password && (
                <p className="text-red-400/80 text-xs">{emailForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm font-medium">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  {...emailForm.register("confirmPassword")}
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  disabled={!isConfigured}
                  className="pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 h-12 disabled:opacity-40"
                />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {emailForm.formState.errors.confirmPassword && (
                <p className="text-red-400/80 text-xs">{emailForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={loading || !isConfigured}
              className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 mt-2 disabled:opacity-40">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <span className="flex items-center gap-2">Create account <ArrowRight className="w-4 h-4" /></span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-white/40">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function emailErrorMsg(err?: any): string {
  const msg = (err?.message ?? "").toLowerCase();
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("invalid email")) return "Please enter a valid email address.";
  if (msg.includes("password")) return "Password is too weak. Use at least 8 characters.";
  if (msg.includes("network") || msg.includes("fetch")) return "Network error. Check your connection.";
  return err?.message || "Sign up failed. Please try again.";
}
