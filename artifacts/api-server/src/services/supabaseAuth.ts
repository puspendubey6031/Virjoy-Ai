import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

// Supabase auth verification uses the project URL + the public anon key.
// These are the same values the frontend uses (VITE_ prefixed), so users only
// configure them once. The anon key is safe to use server-side for verifying a
// user's access token via the Auth API (`getUser`).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

const isValidUrl = (u?: string): u is string =>
  !!u && (u.startsWith("http://") || u.startsWith("https://"));

if (isValidUrl(SUPABASE_URL) && SUPABASE_ANON_KEY) {
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    logger.info("Supabase auth initialized");
  } catch (err) {
    _client = null;
    logger.error({ err }, "Failed to initialize Supabase auth client");
  }
} else if (SUPABASE_URL || SUPABASE_ANON_KEY) {
  logger.warn(
    "Supabase auth misconfigured — VITE_SUPABASE_URL must be a valid https URL (https://<ref>.supabase.co) and VITE_SUPABASE_ANON_KEY must be set",
  );
} else {
  logger.warn(
    "Supabase auth not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication",
  );
}

export function isSupabaseAuthReady(): boolean {
  return _client !== null;
}

export interface SupabaseAuthUser {
  id: string;
  email: string | null;
}

/**
 * Verify a Supabase access token (JWT) by asking the Supabase Auth API who it
 * belongs to. Throws when the token is missing/invalid/expired.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseAuthUser> {
  if (!_client) {
    throw new Error(
      "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const { data, error } = await _client.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error(error?.message ?? "Invalid or expired token");
  }

  return { id: data.user.id, email: data.user.email ?? null };
}
