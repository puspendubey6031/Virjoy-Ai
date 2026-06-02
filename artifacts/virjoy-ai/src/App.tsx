import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Video, History, Sparkles, LogOut, Coins,
  UserCircle, Menu, X, ChevronDown, ShieldCheck, Crown, Zap, Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";
import Studio from "@/pages/studio";
import HistoryPage from "@/pages/history";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AccountPage from "@/pages/account";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth-modal";

const queryClient = new QueryClient();

// ── Plan config ───────────────────────────────────────────────────────────────
const planConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free:    { label: "Free",    color: "text-white/50",   icon: <Coins className="w-3 h-3" /> },
  starter: { label: "Starter", color: "text-yellow-400", icon: <Coins className="w-3 h-3" /> },
  creator: { label: "Creator", color: "text-blue-400",   icon: <Crown className="w-3 h-3" /> },
  premium: { label: "Premium", color: "text-purple-400", icon: <Crown className="w-3 h-3" /> },
};

function getMaxCredits(plan: string) {
  const maxes: Record<string, number> = { free: 5, starter: 50, creator: 150, premium: 400 };
  return maxes[plan] ?? 5;
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown() {
  const { supabaseUser, dbUser, signOut } = useAuth();
  if (!supabaseUser) return null;
  const plan = planConfig[dbUser?.currentPlan ?? "free"] ?? planConfig.free!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 focus:outline-none">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(supabaseUser.email?.[0] ?? "U").toUpperCase()}
          </div>
          <span className="hidden lg:block text-sm text-white/70 max-w-[110px] truncate">
            {supabaseUser.email}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end"
        className="w-64 bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white shadow-2xl mt-2">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {(supabaseUser.email?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{supabaseUser.email}</p>
              <div className={`flex items-center gap-1 text-xs mt-0.5 ${plan.color}`}>
                {plan.icon}
                <span>{plan.label} plan</span>
                {dbUser?.mobileVerified && <ShieldCheck className="w-3 h-3 ml-1 text-green-400" />}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        {dbUser && (
          <div className="px-3 py-2.5 mx-1 my-1 rounded-lg bg-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/50">Credits remaining</span>
              <span className={`text-sm font-bold ${plan.color}`}>{dbUser.credits}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500"
                style={{ width: `${Math.min(100, (dbUser.credits / getMaxCredits(dbUser.currentPlan)) * 100)}%` }} />
            </div>
          </div>
        )}

        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild
          className="mx-1 my-1 gap-2 text-white/70 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white cursor-pointer">
          <Link href="/account">
            <Settings className="w-4 h-4" /> Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}
          className="mx-1 my-1 gap-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400 cursor-pointer">
          <LogOut className="w-4 h-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
interface NavbarProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

function Navbar({ onSignIn, onGetStarted }: NavbarProps) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { supabaseUser, dbUser, authLoading, signOut } = useAuth();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const navLinks = [
    { href: "/", label: "Studio", icon: <Video className="w-4 h-4" /> },
    { href: "/history", label: "History", icon: <History className="w-4 h-4" /> },
  ];

  return (
    <>
      <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled || mobileOpen
          ? "bg-background/90 backdrop-blur-xl border-b border-primary/20 shadow-[0_4px_30px_-10px_rgba(var(--primary),0.2)]"
          : "bg-transparent border-b border-transparent"
      }`}>
        <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="font-black text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              VirJoy AI
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  location === l.href
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}>
                <span className="flex items-center gap-2">{l.icon}{l.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="w-px h-6 bg-white/10" />
            <AnimatePresence mode="wait">
              {authLoading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
              ) : supabaseUser ? (
                <motion.div key="user" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <ProfileDropdown />
                </motion.div>
              ) : (
                <motion.div key="guest" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2">
                  <button onClick={onSignIn}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all duration-300">
                    Sign In
                  </button>
                  <button onClick={onGetStarted}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary/80 to-cyan-500/80 hover:from-primary hover:to-cyan-500 text-white shadow-md shadow-primary/20 transition-all duration-300">
                    Get Started
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile right: sign-in pill + avatar + hamburger */}
          <div className="flex sm:hidden items-center gap-2 shrink-0">
            {!authLoading && !supabaseUser && (
              <button onClick={onSignIn}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-primary/50 bg-primary/10 hover:bg-primary/20 transition-all">
                Sign In
              </button>
            )}
            {!authLoading && supabaseUser && <ProfileDropdown />}
            <button onClick={() => setMobileOpen((o) => !o)}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Toggle menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
              className="overflow-hidden sm:hidden border-t border-white/10">
              <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                {navLinks.map((l) => (
                  <Link key={l.href} href={l.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      location === l.href
                        ? "bg-primary/20 text-white border border-primary/30"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}>
                    {l.icon}{l.label}
                  </Link>
                ))}

                {!authLoading && (
                  <>
                    <div className="h-px bg-white/10 my-1" />
                    {supabaseUser ? (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {(supabaseUser.email?.[0] ?? "U").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{supabaseUser.email}</p>
                            {dbUser && (
                              <p className={`text-xs mt-0.5 ${planConfig[dbUser.currentPlan]?.color ?? "text-white/50"}`}>
                                {dbUser.credits} credits · {planConfig[dbUser.currentPlan]?.label ?? "Free"} plan
                              </p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => signOut()}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => { setMobileOpen(false); onSignIn(); }}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                          <UserCircle className="w-4 h-4" /> Sign In
                        </button>
                        <button onClick={() => { setMobileOpen(false); onGetStarted(); }}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-cyan-500 shadow-lg shadow-primary/20 transition-all">
                          <Sparkles className="w-4 h-4" /> Get Started Free
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}

// ── Guest banner ──────────────────────────────────────────────────────────────
function GuestBanner({ onGetStarted }: { onGetStarted: () => void }) {
  const { supabaseUser, authLoading } = useAuth();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (authLoading || supabaseUser || dismissed || location !== "/") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, delay: 0.8 }}
      className="fixed top-16 sm:top-20 left-0 right-0 z-40 flex items-center justify-center px-4 py-2 gap-3
        bg-gradient-to-r from-primary/20 via-primary/10 to-cyan-500/20 border-b border-primary/20 backdrop-blur-sm"
    >
      <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
      <p className="text-xs sm:text-sm text-white/80">
        <span className="font-semibold text-white">Sign up free</span> and get{" "}
        <span className="text-primary font-bold">5 credits</span> to generate your first AI video
      </p>
      <button
        onClick={onGetStarted}
        className="shrink-0 px-3 py-1 rounded-lg text-xs font-bold bg-primary/80 hover:bg-primary text-white transition-all shadow-md shadow-primary/20"
      >
        Get Started
      </button>
      <button onClick={() => setDismissed(true)}
        className="shrink-0 p-1 text-white/30 hover:text-white/60 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  const [modalState, setModalState] = useState<{ open: boolean; tab: "login" | "signup" }>({
    open: false,
    tab: "login",
  });

  const openLogin = () => setModalState({ open: true, tab: "login" });
  const openSignup = () => setModalState({ open: true, tab: "signup" });
  const closeModal = () => setModalState((s) => ({ ...s, open: false }));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary/30 relative">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10 pointer-events-none" />

      <Navbar onSignIn={openLogin} onGetStarted={openSignup} />
      <GuestBanner onGetStarted={openSignup} />

      <Switch>
        <Route path="/" component={Studio} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/account" component={AccountPage} />
        <Route component={NotFound} />
      </Switch>

      <AuthModal
        open={modalState.open}
        defaultTab={modalState.tab}
        onClose={closeModal}
      />
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <Toaster />
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
