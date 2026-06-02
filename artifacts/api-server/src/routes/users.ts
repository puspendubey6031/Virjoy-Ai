import { Router } from "express";
import { db, usersTable, creditLogsTable, videoJobsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * GET /api/users/me
 * Full profile + credit balance.
 */
router.get("/users/me", requireAuth, (req, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    mobileNumber: user.mobileNumber,
    mobileVerified: user.mobileVerified,
    username: user.username,
    currentPlan: user.currentPlan,
    credits: user.credits,
    freeCreditsLastClaimed: user.freeCreditsLastClaimed?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

/**
 * GET /api/users/me/credits
 * Credit balance + last 20 transactions.
 */
router.get("/users/me/credits", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [current] = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const logs = await db
    .select()
    .from(creditLogsTable)
    .where(eq(creditLogsTable.userId, userId))
    .orderBy(desc(creditLogsTable.createdAt))
    .limit(20);

  res.json({
    balance: current?.credits ?? 0,
    transactions: logs.map((l) => ({
      id: l.id,
      action: l.action,
      creditsUsed: l.creditsUsed,
      creditsBefore: l.creditsBefore,
      creditsAfter: l.creditsAfter,
      jobId: l.jobId,
      description: l.description,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

/**
 * GET /api/users/me/generations
 * Last 50 video jobs for this user (guest jobs not linked).
 */
router.get("/users/me/generations", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  // Match via credit_logs → jobId — jobs created by this user
  const logs = await db
    .select({ jobId: creditLogsTable.jobId })
    .from(creditLogsTable)
    .where(and(eq(creditLogsTable.userId, userId), eq(creditLogsTable.action, "generate_video")))
    .orderBy(desc(creditLogsTable.createdAt))
    .limit(50);

  const jobIds = logs.map((l) => l.jobId).filter((id): id is number => id !== null);

  if (jobIds.length === 0) {
    res.json([]);
    return;
  }

  const jobs = await db
    .select()
    .from(videoJobsTable)
    .where(eq(videoJobsTable.id, jobIds[0]!))
    .orderBy(desc(videoJobsTable.createdAt));

  res.json(
    jobs.map((job) => ({
      id: String(job.id),
      prompt: job.prompt,
      title: job.title,
      videoType: job.videoType,
      duration: job.duration,
      plan: job.plan,
      status: job.status,
      outputUrl: job.outputUrl,
      createdAt: job.createdAt.toISOString(),
    })),
  );
});

/**
 * PATCH /api/users/me
 * Update display name.
 */
router.patch("/users/me", requireAuth, async (req, res) => {
  const { username } = req.body as { username?: string };

  if (!username?.trim()) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ username: username.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({ id: updated.id, username: updated.username });
});

export default router;
