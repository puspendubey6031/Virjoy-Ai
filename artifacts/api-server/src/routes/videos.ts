import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { db, videoJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PLAN_MAP, VALID_PLANS, VALID_DURATIONS } from "../config/plans";
import { processVideo } from "../lib/videoProcessor";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import {
  calculateCreditCost,
  hasSufficientCredits,
  deductCredits,
} from "../services/credits";

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const OUTPUT_DIR = path.resolve(process.cwd(), "output");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

function detectVideoType(prompt: string): "ad" | "horror" | "promo" | "vlog" {
  const lower = prompt.toLowerCase();
  if (/horror|scary|dark|thriller|spooky|terror|ghost|nightmare|creepy|eerie|sinister/.test(lower))
    return "horror";
  if (/vlog|lifestyle|personal|daily|routine|travel|diary|day in|my life|behind the scenes/.test(lower))
    return "vlog";
  if (/\bad\b|commercial|advertisement|product launch|sell|buy|sale|offer|deal|discount/.test(lower))
    return "ad";
  return "promo";
}

// GET /api/videos
router.get("/videos", async (req, res) => {
  const jobs = await db.select().from(videoJobsTable).orderBy(videoJobsTable.createdAt);
  res.json(jobs.map(formatJob));
});

// GET /api/videos/summary
router.get("/videos/summary", async (req, res) => {
  const jobs = await db.select().from(videoJobsTable);
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byPlan: Record<string, number> = {};

  for (const job of jobs) {
    byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;
    byType[job.videoType] = (byType[job.videoType] ?? 0) + 1;
    byPlan[job.plan] = (byPlan[job.plan] ?? 0) + 1;
  }

  res.json({ total: jobs.length, byStatus, byType, byPlan });
});

// POST /api/videos
router.post(
  "/videos",
  requireAuth,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "clips", maxCount: 20 },
  ]),
  async (req, res) => {
    const { prompt, title, videoType: explicitType, duration, plan } = req.body as Record<string, string>;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const images = files?.["images"] ?? [];
    const clips = files?.["clips"] ?? [];

    if (!plan || !VALID_PLANS.includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (!VALID_DURATIONS.includes(durationNum)) {
      res.status(400).json({ error: "Invalid duration. Must be 10, 30, 60, or 180" });
      return;
    }

    const videoType: "ad" | "horror" | "promo" | "vlog" =
      explicitType && ["ad", "horror", "promo", "vlog"].includes(explicitType)
        ? (explicitType as "ad" | "horror" | "promo" | "vlog")
        : prompt
        ? detectVideoType(prompt)
        : "promo";

    const planConfig = PLAN_MAP[plan];

    if (images.length > planConfig.maxImages) {
      res.status(400).json({ error: `Your ${planConfig.name} plan allows max ${planConfig.maxImages} image(s)` });
      return;
    }

    if (clips.length > planConfig.maxClips) {
      res.status(400).json({ error: `Your ${planConfig.name} plan allows max ${planConfig.maxClips} clip(s)` });
      return;
    }

    if (durationNum > planConfig.maxDuration) {
      res.status(400).json({ error: `Your ${planConfig.name} plan allows max ${planConfig.maxDuration}s duration` });
      return;
    }

    // Credit check — only for authenticated users
    const user = req.user;
    let creditCost = 0;

    if (user) {
      creditCost = calculateCreditCost({
        duration: durationNum,
        clipCount: clips.length,
        plan,
      });

      const sufficient = await hasSufficientCredits(user.id, creditCost);
      if (!sufficient) {
        res.status(402).json({
          error: "Insufficient credits",
          required: creditCost,
          available: user.credits,
          message: `This video costs ${creditCost} credits. You have ${user.credits}. Please upgrade your plan or wait for monthly credits.`,
        });
        return;
      }
    }

    const [job] = await db
      .insert(videoJobsTable)
      .values({
        prompt: prompt || null,
        title: title || null,
        videoType,
        duration: durationNum,
        plan,
        status: "queued",
        hasWatermark: planConfig.watermark,
        imageCount: images.length,
        clipCount: clips.length,
      })
      .returning();

    req.log.info(
      { jobId: job.id, videoType, hasPrompt: !!prompt, userId: user?.id, creditCost },
      "Video job created",
    );
    res.status(201).json(formatJob(job));

    // Async processing — deduct credits only on success
    setImmediate(async () => {
      try {
        await db
          .update(videoJobsTable)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(videoJobsTable.id, job.id));

        const outputPath = await processVideo({
          jobId: job.id,
          prompt: prompt || undefined,
          videoType,
          duration: durationNum,
          plan,
          hasWatermark: planConfig.watermark,
          imagePaths: images.map((f) => f.path),
          clipPaths: clips.map((f) => f.path),
          outputDir: OUTPUT_DIR,
        });

        const outputUrl = `/api/videos/file/${path.basename(outputPath)}`;

        await db
          .update(videoJobsTable)
          .set({ status: "done", outputPath, outputUrl, updatedAt: new Date() })
          .where(eq(videoJobsTable.id, job.id));

        // Deduct credits after confirmed success
        if (user && creditCost > 0) {
          await deductCredits({
            userId: user.id,
            cost: creditCost,
            jobId: job.id,
            action: "generate_video",
            description: `Generated ${durationNum}s ${videoType} video (${clips.length} clips)`,
          });
        }

        logger.info({ jobId: job.id, userId: user?.id, creditCost }, "Video job completed");
      } catch (err) {
        logger.error({ err, jobId: job.id }, "Video job failed — no credits deducted");
        await db
          .update(videoJobsTable)
          .set({
            status: "failed",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(videoJobsTable.id, job.id));
        // No credit deduction on failure (as per spec)
      }
    });
  },
);

// GET /api/videos/:id
router.get("/videos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [job] = await db.select().from(videoJobsTable).where(eq(videoJobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Video job not found" });
    return;
  }

  res.json(formatJob(job));
});

// DELETE /api/videos/:id
router.delete("/videos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [job] = await db.select().from(videoJobsTable).where(eq(videoJobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Video job not found" });
    return;
  }

  if (job.outputPath) {
    await fs.unlink(job.outputPath).catch(() => {});
  }

  await db.delete(videoJobsTable).where(eq(videoJobsTable.id, id));
  res.json({ success: true });
});

// Serve output files
router.get("/videos/file/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(OUTPUT_DIR, filename);

  try {
    await fs.access(filePath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const { createReadStream } = await import("fs");
    createReadStream(filePath).pipe(res);
  } catch {
    // Check if this file belonged to an expired job
    const [expired] = await db
      .select({ status: videoJobsTable.status })
      .from(videoJobsTable)
      .where(eq(videoJobsTable.status, "expired"));

    if (expired) {
      res.status(410).json({
        error: "Video expired",
        message: "Generated videos are automatically removed after 24 hours. Please generate a new video.",
      });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  }
});

function formatJob(job: typeof videoJobsTable.$inferSelect) {
  return {
    id: String(job.id),
    prompt: job.prompt ?? null,
    title: job.title ?? null,
    videoType: job.videoType,
    duration: job.duration,
    plan: job.plan,
    status: job.status,
    hasWatermark: job.hasWatermark,
    outputUrl: job.outputUrl ?? null,
    errorMessage: job.errorMessage ?? null,
    imageCount: job.imageCount,
    clipCount: job.clipCount,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export default router;
