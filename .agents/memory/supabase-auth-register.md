---
name: Supabase auth register idempotency
description: How VirJoy's /api/auth/register stays exactly-once for welcome credits and links legacy accounts.
---

# Supabase auth register — idempotency & account linking

`POST /api/auth/register` is called on **every** auth state change from the
frontend (Supabase `onAuthStateChange`), so it must be safe to call repeatedly.

Resolution order in the handler:
1. Existing row by `supabaseUid` → update profile, return. No credits.
2. Existing row by `email` with no `supabaseUid` (legacy Firebase user) → link
   by setting `supabaseUid`, return. No new credits.
3. New insert with `.onConflictDoNothing({ target: supabaseUid })`. Only the
   insert that actually returns a row grants the 5 welcome credits. A concurrent
   loser gets `inserted.length === 0`, re-selects, returns without granting.

**Why:** two near-simultaneous register calls (the old AuthContext called both
`getSession()` and `onAuthStateChange`) raced — one would insert, the other 401
on unique conflict, risking a double credit grant or a failed sign-in. The
frontend now relies on `onAuthStateChange` alone (it emits INITIAL_SESSION), and
the backend insert is conflict-guarded so credits are granted exactly once.

**How to apply:** never grant credits in the "existing user" path; only the
real insert grants. Keep the email-link branch so pre-migration accounts don't
duplicate. `mobileVerified` is forced `true` because phone OTP was dropped in
the Supabase migration — it's vestigial, kept only so `requireMobileVerified`
routes still function.

## Email confirmation is ENABLED on the Supabase project

`signUp` returns **no session** — users must click the email link before
`signInWithPassword` works (otherwise "Email not confirmed"). The signup flow
returns `needsConfirmation: true` and shows a "check your email" state; this is
expected, not a bug. To allow instant sign-in, the project owner must turn off
"Confirm email" in the Supabase dashboard (Authentication settings) — it cannot
be changed from code.

**Verification note:** Supabase also rejects obviously-fake test emails
("address is invalid"), and `viewEnvVars` in the code-execution sandbox masks
secret *values* (returns `true` for presence only). So a fully-automated
sign-in/session test isn't possible from the sandbox — needs a real inbox or
email-confirmation disabled.

## Password reset page must gate on PASSWORD_RECOVERY only

`reset-password.tsx` must unlock the new-password form **only** after the
`PASSWORD_RECOVERY` auth event (recovery link parsed from URL), never on any
existing session. **Why:** unlocking on a normal logged-in session lets a user
change the wrong account's password thinking they're completing a recovery
flow. Show an explicit invalid/expired state with a "request new link" CTA when
the URL carries no recovery payload (`type=recovery`/`access_token` in hash or
`code=` in query).
