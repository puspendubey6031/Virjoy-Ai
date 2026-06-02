import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth";
import { attachPlan, requireFeature } from "../middleware/planGuard";
import { hasSufficientCredits, deductCredits, CREDIT_COSTS } from "../services/credits";

const router = Router();

// AI story generation is gated behind the `aiStory` plan feature (Premium).
// The plan is resolved from the authenticated user's DB record, not client input.
router.post("/ai/story", requireAuth, attachPlan, requireFeature("aiStory"), async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // requireAuth guarantees an authenticated user at this point.
  const user = req.user!;
  const sufficient = await hasSufficientCredits(user.id, CREDIT_COSTS.aiStory);
  if (!sufficient) {
    res.status(402).json({
      error: "Insufficient credits",
      required: CREDIT_COSTS.aiStory,
      available: user.credits,
      message: `AI story generation costs ${CREDIT_COSTS.aiStory} credits. You have ${user.credits}.`,
    });
    return;
  }

  const systemPrompt = `You are a professional cinematic video script writer for VirJoy AI.

The user has provided this prompt: "${prompt}"

Analyze the prompt and:
1. Detect the best video style (ad, horror, promo, or vlog)
2. Generate a compelling title
3. Write a 2-3 sentence narrative description  
4. Create 3-6 cinematic scenes

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "title": "A catchy, concise title derived from the prompt",
  "story": "A 2-3 sentence narrative description of the overall video story",
  "detectedType": "promo",
  "scenes": [
    {
      "index": 1,
      "description": "Detailed visual description of this scene",
      "duration": 10,
      "effect": "zoom-in"
    }
  ]
}

Style detection rules:
- horror: if prompt contains dark, scary, thriller, ghost, nightmare, etc → "horror"
- vlog: if lifestyle, personal, travel, daily, diary, etc → "vlog"  
- ad: if product, commercial, advertisement, sell, buy, offer → "ad"
- otherwise → "promo"

Effect options: zoom-in, zoom-out, fade, pan-left, pan-right, cross-fade
Total scene durations should sum to 30-90 seconds.
Make it cinematic, specific, and compelling.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      config: { maxOutputTokens: 8192 },
    });

    const text = response.text ?? "";
    const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();

    let parsed: {
      title: string;
      story: string;
      detectedType: string;
      scenes: Array<{ index: number; description: string; duration: number; effect: string }>;
    };

    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      req.log.error({ text }, "Failed to parse Gemini response as JSON");
      res.status(500).json({ error: "AI returned an invalid response. Please try again." });
      return;
    }

    if (!parsed.title || !parsed.story || !Array.isArray(parsed.scenes)) {
      res.status(500).json({ error: "AI returned incomplete story data. Please try again." });
      return;
    }

    const validTypes = ["ad", "horror", "promo", "vlog"];
    if (!validTypes.includes(parsed.detectedType)) {
      parsed.detectedType = "promo";
    }

    // Deduct credits after confirmed success
    if (user) {
      await deductCredits({
        userId: user.id,
        cost: CREDIT_COSTS.aiStory,
        action: "ai_story",
        description: "Gemini AI cinematic story generation",
      });
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Gemini AI story generation failed");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

export default router;
