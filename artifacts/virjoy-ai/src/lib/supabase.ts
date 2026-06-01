import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase configuration
//
// Add these to Replit Secrets (or a .env.local file for local dev):
//
//   VITE_SUPABASE_URL        — your project URL (https://xxxx.supabase.co)
//   VITE_SUPABASE_ANON_KEY   — the public anon key (safe to expose in browser)
//
// The app runs without auth when these are not set — auth UI shows a
// "not configured" state rather than crashing.
// ─────────────────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (u?: string): u is string =>
  !!u && (u.startsWith("http://") || u.startsWith("https://"));

let _supabase: SupabaseClient | null = null;

if (isValidUrl(url) && anonKey) {
  try {
    _supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error("Failed to initialize Supabase client", err);
    _supabase = null;
  }
}

export const isSupabaseConfigured = _supabase !== null;

export const supabase = _supabase;
export default _supabase;
