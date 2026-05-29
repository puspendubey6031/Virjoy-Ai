import { Router } from "express";
import { db, usersTable, creditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyFirebaseToken, isFirebaseReady } from "../services/firebase";
import { addCredits, PLAN_MONTHLY_CREDITS } from "../services/credits";
import { requireAuth, requireMobileVerified } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/register
 *
 * Called by the frontend after Firebase sign-up. The Firebase ID token must
 * include a linked phone number (Firebase phone auth must be completed first).
 *
 * Body: { firebaseToken: string, username?: string }
 */
router.post("/auth/register", async (req, res) => {
  if (!isFirebaseReady()) {
    res.status(503).json({ error: "Authentication service not configured" });
    return;
  }

  // Token is sent in the Authorization header by the frontend; fall back to
  // the request body for backwards compatibility.
  const authHeader = req.headers.authorization;
  const firebaseToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (req.body as { firebaseToken?: string }).firebaseToken;
  const { username } = req.body as { username?: string };

  if (!firebaseToken) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = await verifyFirebaseToken(firebaseToken);

    if (!decoded.email) {
      res.status(400).json({ error: "Firebase account must have a verified email" });
      return;
    }

    const mobileVerified = !!decoded.phone_number;
    const mobileNumber = decoded.phone_number ?? null;

    // Upsert user record
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, decoded.uid));

    let user;

    if (existing.length > 0) {
      // Update returning user
      const [updated] = await db
        .update(usersTable)
        .set({
          email: decoded.email,
          mobileNumber: mobileNumber ?? existing[0].mobileNumber,
          mobileVerified: mobileVerified || existing[0].mobileVerified,
          username: username ?? existing[0].username,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.firebaseUid, decoded.uid))
        .returning();
      user = updated;
    } else {
      // New registration — grant free credits
      const [created] = await db
        .insert(usersTable)
        .values({
          firebaseUid: decoded.uid,
          email: decoded.email,
          mobileNumber,
          mobileVerified,
          username: username ?? decoded.name ?? null,
          currentPlan: "free",
          credits: 0,
          freeCreditsLastClaimed: new Date(),
        })
        .returning();

      user = created;

      // Grant 5 free welcome credits
      await addCredits({
        userId: user.id,
        amount: PLAN_MONTHLY_CREDITS.free,
        action: "free_credit",
        description: "Welcome credits for new account",
      });

      // Fetch updated user with credits
      const [fresh] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
      user = fresh;
    }

    req.log.info({ userId: user.id, email: user.email, mobileVerified }, "User registered/updated");
    res.status(201).json(formatUser(user));
  } catch (err: any) {
    req.log.error({ err }, "Registration failed");
    if (err.code === "auth/id-token-expired") {
      res.status(401).json({ error: "Token expired. Please sign in again." });
      return;
    }
    if (err.code?.startsWith("auth/")) {
      res.status(401).json({ error: "Invalid Firebase token" });
      return;
    }
    res.status(500).json({ error: "Registration failed. Please try again." });
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
