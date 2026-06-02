import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Mail, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type Form = z.infer<typeof schema>;

export default function AccountPage() {
  const [, navigate] = useLocation();
  const { supabaseUser, authLoading, updateEmail, isConfigured } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Redirect signed-out visitors to the sign-in page.
  useEffect(() => {
    if (!authLoading && !supabaseUser) navigate("/login");
  }, [authLoading, supabaseUser, navigate]);

  const currentEmail = supabaseUser?.email ?? "";

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { email: currentEmail },
  });

  const onSubmit = async (data: Form) => {
    if (data.email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      toast({ title: "No change", description: "That's already your account email." });
      return;
    }
    setLoading(true);
    try {
      await updateEmail(data.email.trim());
      toast({
        title: "Confirm your new email",
        description: "We sent a confirmation link to your new address. The change applies once confirmed.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't change email",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
              Account settings
            </h1>
            <p className="text-white/50 text-sm mt-1">Manage your account email</p>
          </div>
        </div>

        {/* Config warning */}
        {!isConfigured && (
          <div className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Authentication not configured</p>
              <p className="text-amber-400/70 mt-0.5">
                Add your <code className="text-amber-300">VITE_SUPABASE_URL</code> and <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> secrets to manage your account.
              </p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={!isConfigured}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/60 focus:ring-primary/20 h-12 disabled:opacity-40"
                />
              </div>
              {errors.email && <p className="text-red-400/80 text-xs">{errors.email.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading || !isConfigured}
              className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all duration-300 mt-2 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Update email <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
