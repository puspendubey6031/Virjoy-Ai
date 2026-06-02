import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const schema = z
  .object({
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

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { updatePassword, supabaseUser, isConfigured } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // The form must only unlock for a genuine recovery session — not for an
  // already-logged-in user who happens to navigate here. Supabase parses the
  // recovery link from the URL (detectSessionInUrl) and emits a
  // PASSWORD_RECOVERY event; we gate strictly on that event.
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    // If the URL carries no recovery payload at all, the page wasn't opened
    // from a reset link — surface an explicit invalid/expired state.
    const hash = window.location.hash ?? "";
    const search = window.location.search ?? "";
    const looksLikeRecovery =
      hash.includes("type=recovery") || hash.includes("access_token") || search.includes("code=");

    let recovered = false;
    const markReady = () => {
      if (!active) return;
      recovered = true;
      setReady(true);
      setInvalid(false);
    };

    // Primary signal: the PASSWORD_RECOVERY event Supabase emits after parsing
    // a valid recovery link. This is the only reliable way to distinguish a
    // recovery session from a normal logged-in session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    // Fallback: only when the URL actually carries recovery params, accept an
    // already-established session (covers the event firing before we
    // subscribed). We never do this for plain navigation, so a normal logged-in
    // user can't unlock the form for the wrong account.
    if (looksLikeRecovery) {
      supabase.auth.getSession().then(({ data }) => {
        if (active && !recovered && data.session) markReady();
      });
    }

    // Safety net: never deadlock. If no recovery context resolves within the
    // grace period, surface an explicit invalid/expired state.
    const timer = setTimeout(() => {
      if (active && !recovered) setInvalid(true);
    }, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await updatePassword(data.password);
      toast({ title: "Password updated", description: "You can now use your new password." });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Couldn't update password",
        description: err?.message || "The reset link may have expired. Request a new one.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasSession = !!supabaseUser;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 pt-24 pb-12">
      {/* Background orbs */}
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
            <p className="text-white/50 text-sm mt-1">Set a new password</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {invalid || (ready && !hasSession) ? (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-300">Reset link invalid or expired</p>
                <p className="text-amber-400/70 mt-0.5">
                  Open the link from your most recent reset email, or{" "}
                  <Link href="/forgot-password" className="text-amber-300 underline underline-offset-2 hover:text-amber-200">
                    request a new one
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : (
            <>
              {!ready && (
                <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-300">Open this page from your reset link</p>
                    <p className="text-amber-400/70 mt-0.5">
                      Use the link we emailed you. If it expired, request a new one.
                    </p>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* New password */}
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm font-medium">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      disabled={!isConfigured || !ready}
                      className="pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-primary/20 h-12 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400/80 text-xs">{errors.password.message}</p>}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm font-medium">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      {...register("confirmPassword")}
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      disabled={!isConfigured || !ready}
                      className="pl-10 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-primary/20 h-12 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-400/80 text-xs">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !isConfigured || !ready}
                  className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all duration-300 mt-2 disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      Update password <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-white/40">
                <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
