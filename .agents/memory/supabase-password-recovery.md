---
name: Supabase password recovery gating
description: How to gate a "set new password" form so it unlocks only for genuine recovery sessions and never deadlocks.
---

# Gating the reset-password form

When implementing "reset password" with `@supabase/supabase-js`, the new-password
form must only be usable inside a genuine recovery session — otherwise a normal
logged-in user landing on the page could change the wrong account's password.

**The rule:**
- Primary signal is the `PASSWORD_RECOVERY` event from `onAuthStateChange`. This
  is the *only* reliable way to distinguish a recovery session from a normal
  logged-in session — `getSession()` alone cannot tell them apart.
- Add a `getSession()` fallback that unlocks the form ONLY when the URL actually
  carries recovery params (`type=recovery` / `access_token` in the hash, or
  `code=` in the query). This covers the event firing before you subscribed,
  without ever unlocking for plain navigation.
- Always add a timeout (~2.5s) that flips to an explicit invalid/expired state
  if nothing resolves. Without it, an expired or timing-edge link leaves the form
  permanently disabled (deadlock) — neither ready nor invalid.

**Why:** an earlier version set `ready=true` only on `PASSWORD_RECOVERY` and only
set `invalid` when the URL did NOT look like recovery. A recovery-looking-but-
expired link (or a missed event) then stranded the user in limbo forever.

**How to apply:** any page that consumes a Supabase recovery/magic link. Note
the client processes and clears the URL hash on load (detectSessionInUrl), so by
the time a React effect runs the params may already be gone — rely on the event,
treat the URL check as best-effort, and lean on the timeout safety net.
