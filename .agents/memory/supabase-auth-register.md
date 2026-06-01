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
