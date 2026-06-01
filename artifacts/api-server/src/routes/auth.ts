import { Router } from "express";
import { db, usersTable, creditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyFirebaseToken, isFirebaseReady } from "../services/firebase";
import { verifySupabaseToken, isSupabaseAuthReady } from "../services/supabaseAuth";
import { addCredits, PLAN_MONTHLY_CREDITS } from "../services/credits";
import { requireAuth, requireMobileVerified } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/register
 *
 * Called by the frontend after a Supabase email/password sign-up or sign-in.
 * Idempotently provisions the local user record from the Supabase access token
 * and grants welcome credits on first registration.
 *
 * Auth: Supabase access token in the Authorization header.
 * Body: { username?: string }
 */
router.post("/auth/register", async (req, res) => {
  if (!isSupabaseAuthReady()) {
    res.status(503).json({ error: "Authentication service not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const { username } = req.body as { username?: string };

  if (!token) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = await verifySupabaseToken(token);

    if (!decoded.email) {
      res.status(400).json({ error: "Account must have a verified email" });
      return;
    }

    // 1. Returning Supabase user — update profile and return.
    const [bySupabase] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.supabaseUid, decoded.id));

    if (bySupabase) {
      const [updated] = await db
        .update(usersTable)
        .set({
          email: decoded.email,
          username: username ?? bySupabase.username,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.supabaseUid, decoded.id))
        .returning();
      req.log.info({ userId: updated.id }, "User profile updated");
      res.status(201).json(formatUser(updated));
      return;
    }

    // 2. Legacy account with the same email (e.g. pre-migration Firebase user
    //    without a supabaseUid) — link it rather than create a duplicate. No
    //    new welcome credits are granted for an existing account.
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, decoded.email));

    if (byEmail) {
      const [linked] = await db
        .update(usersTable)
        .set({
          supabaseUid: decoded.id,
          username: username ?? byEmail.username,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, byEmail.id))
        .returning();
      req.log.info({ userId: linked.id }, "Linked existing account to Supabase");
      res.status(201).json(formatUser(linked));
      return;
    }

    // 3. New registration. `onConflictDoNothing` guards against a concurrent
    //    duplicate insert (two register calls firing for the same fresh
    //    session) so welcome credits are granted exactly once — only the
    //    insert that actually creates the row proceeds to grant credits.
    const inserted = await db
      .insert(usersTable)
      .values({
        supabaseUid: decoded.id,
        email: decoded.email,
        mobileVerified: true,
        username: username ?? null,
        currentPlan: "free",
        credits: 0,
        freeCreditsLastClaimed: new Date(),
      })
      .onConflictDoNothing({ target: usersTable.supabaseUid })
      .returning();

    if (inserted.length === 0) {
      // A concurrent request won the insert — return that record without
      // granting a second batch of credits.
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.supabaseUid, decoded.id));
      res.status(201).json(formatUser(existing));
      return;
    }

    const created = inserted[0];

    // Grant 5 free welcome credits (exactly once, for the real new account).
    await addCredits({
      userId: created.id,
      amount: PLAN_MONTHLY_CREDITS.free,
      action: "free_credit",
      description: "Welcome credits for new account",
    });

    const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, created.id));
    req.log.info({ userId: fresh.id, email: fresh.email }, "New user registered");
    res.status(201).json(formatUser(fresh));
  } catch (err: any) {
    req.log.error({ err }, "Registration failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

/**
 * POST /api/auth/verify-mobile
 *
 * Called after the user completes Firebase phone OTP verification.
 * The new token should have phone_number populated.
 *
 * Body: { firebaseToken: string }
 */
router.post("/auth/verify-mobile", requireAuth, async (req, res) => {
  const { firebaseToken } = req.body as { firebaseToken?: string };

  if (!firebaseToken) {
    res.status(400).json({ error: "firebaseToken is required" });
    return;
  }

  try {
    const decoded = await verifyFirebaseToken(firebaseToken);

    if (!decoded.phone_number) {
      res.status(400).json({
        error: "Phone number not found in token. Please complete OTP verification in Firebase first.",
      });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        mobileNumber: decoded.phone_number,
        mobileVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.user!.id))
      .returning();

    req.log.info({ userId: updated.id }, "Mobile number verified");
    res.json(formatUser(updated));
  } catch (err: any) {
    req.log.error({ err }, "Mobile verification failed");
    res.status(400).json({ error: "Verification failed. Please try again." });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user's profile.
 */
router.get("/auth/me", requireAuth, (req, res) => {
  res.json(formatUser(req.user!));
});

/**
 * POST /api/auth/claim-free-credits
 * Claim monthly free credits (once per 30 days).
 */
router.post("/auth/claim-free-credits", requireAuth, requireMobileVerified, async (req, res) => {
  const user = req.user!;
  const { canClaimFreeCredits } = await import("../services/credits");

  if (!canClaimFreeCredits(user.freeCreditsLastClaimed)) {
    const nextClaim = new Date(user.freeCreditsLastClaimed!);
    nextClaim.setDate(nextClaim.getDate() + 30);
    res.status(429).json({
      error: "Free credits already claimed this month",
      nextClaimAt: nextClaim.toISOString(),
    });
    return;
  }

  const newBalance = await addCredits({
    userId: user.id,
    amount: PLAN_MONTHLY_CREDITS.free,
    action: "free_credit",
    description: "Monthly free credit allocation",
  });

  await db
    .update(usersTable)
    .set({ freeCreditsLastClaimed: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({ credited: PLAN_MONTHLY_CREDITS.free, balance: newBalance });
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    mobileNumber: user.mobileNumber,
    mobileVerified: user.mobileVerified,
    username: user.username,
    currentPlan: user.currentPlan,
    credits: user.credits,
    createdAt: user.createdAt.toISOString(),
  };
}

export default router;
