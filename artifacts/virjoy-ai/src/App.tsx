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
  Video,
  History,
  Sparkles,
  LogOut,
  Coins,
  UserCircle,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";
import Studio from "@/pages/studio";
import HistoryPage from "@/pages/history";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

// ── Plan badge colours ────────────────────────────────────────────────────────
const planConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free:    { label: "Free",    color: "text-white/50",  icon: <Coins className="w-3 h-3" /> },
  starter: { label: "Starter", color: "text-yellow-400", icon: <Coins className="w-3 h-3" /> },
  creator: { label: "Creator", color: "text-blue-400",   icon: <Crown className="w-3 h-3" /> },
  premium: { label: "Premium", color: "text-purple-400", icon: <Crown className="w-3 h-3" /> },
};

// ── Profile dropdown (desktop) ────────────────────────────────────────────────
function ProfileDropdown() {
  const { firebaseUser, dbUser, signOut } = useAuth();
  if (!firebaseUser) return null;

  const plan = planConfig[dbUser?.currentPlan ?? "free"] ?? planConfig.free!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 focus:outline-none">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(firebaseUser.email?.[0] ?? "U").toUpperCase()}
          </div>
          <span className="hidden md:block text-sm text-white/70 max-w-[110px] truncate">
            {firebaseUser.email}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-white/40 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white shadow-2xl mt-2"
      >
        {/* User info header */}
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {(firebaseUser.email?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{firebaseUser.email}</p>
              <div className={`flex items-center gap-1 text-xs mt-0.5 ${plan.color}`}>
                {plan.icon}
                <span>{plan.label} plan</span>
                {dbUser?.mobileVerified && (
                  <ShieldCheck className="w-3 h-3 ml-1 text-green-400" />
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Credits */}
        {dbUser && (
          <div className="px-3 py-2.5 mx-1 my-1 rounded-lg bg-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Credits remaining</span>
              <span className={`text-sm font-bold ${plan.color}`}>{dbUser.credits}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (dbUser.credits / getMaxCredits(dbUser.currentPlan)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={() => signOut()}
          className="mx-1 my-1 gap-2 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getMaxCredits(plan: string) {
  const maxes: Record<string, number> = { free: 5, starter: 50, creator: 150, premium: 400 };
  return maxes[plan] ?? 5;
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { firebaseUser, dbUser, authLoading, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  const navLinks = [
    { href: "/", label: "Studio", icon: <Video className="w-4 h-4" /> },
    { href: "/history", label: "History", icon: <History className="w-4 h-4" /> },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled || mobileOpen
            ? "bg-background/90 backdrop-blur-xl border-b border-primary/20 shadow-[0_4px_30px_-10px_rgba(var(--primary),0.2)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary via-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="font-black text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
              VirJoy AI
            </span>
          </Link>

          {/* Desktop nav links (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  location === l.href
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2">{l.icon}{l.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop auth area (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-px h-6 bg-white/10" />
            <AnimatePresence mode="wait">
              {authLoading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
              ) : firebaseUser ? (
                <motion.div key="user" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <ProfileDropdown />
                </motion.div>
              ) : (
                <motion.div key="guest" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2">
                  <Link href="/login"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all duration-300">
                    Sign In
                  </Link>
                  <Link href="/signup"
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary/80 to-cyan-500/80 hover:from-primary hover:to-cyan-500 text-white shadow-md shadow-primary/20 transition-all duration-300">
                    Get Started
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile right side: avatar (if logged in) + hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            {!authLoading && firebaseUser && <ProfileDropdown />}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden sm:hidden border-t border-white/10"
            >
              <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                {/* Nav links */}
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      location === l.href
                        ? "bg-primary/20 text-white border border-primary/30"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {l.icon}{l.label}
                  </Link>
                ))}

                {/* Auth section */}
                {!authLoading && (
                  <>
                    <div className="h-px bg-white/10 my-1" />
                    {firebaseUser ? (
                      <>
                        {/* Mobile user info */}
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {(firebaseUser.email?.[0] ?? "U").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{firebaseUser.email}</p>
                            {dbUser && (
                              <p className={`text-xs mt-0.5 ${planConfig[dbUser.currentPlan]?.color ?? "text-white/50"}`}>
                                {dbUser.credits} credits · {planConfig[dbUser.currentPlan]?.label ?? "Free"} plan
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => signOut()}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Link href="/login"
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                          <UserCircle className="w-4 h-4" /> Sign In
                        </Link>
                        <Link href="/signup"
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-cyan-500 shadow-lg shadow-primary/20 transition-all">
                          <Sparkles className="w-4 h-4" /> Get Started Free
                        </Link>
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

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary/30 relative">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10 pointer-events-none" />
      <Navbar />
      <Switch>
        <Route path="/" component={Studio} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route component={NotFound} />
      </Switch>
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
