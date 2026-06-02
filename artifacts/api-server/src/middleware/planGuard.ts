import type { Request, Response, NextFunction } from "express";
import { PLAN_MAP, type PlanConfig } from "../config/plans";

/**
 * Resolves the user's effective plan from the database record (source of truth)
 * and attaches the full plan configuration to the request as `req.planConfig`.
 *
 * IMPORTANT: This middleware must run AFTER `requireAuth` so that `req.user` is
 * populated. The plan is NEVER taken from client input — only from the
 * authenticated user's stored `currentPlan`. This prevents clients from
 * escalating limits by sending a forged `plan` field.
 */
export function attachPlan(req: Request, _res: Response, next: NextFunction): void {
  const planId = req.user?.currentPlan ?? "free";
  req.planConfig = PLAN_MAP[planId] ?? PLAN_MAP["free"];
  next();
}

/** Keys of PlanConfig whose value is a boolean feature flag. */
type BooleanFeature = {
  [K in keyof PlanConfig]: PlanConfig[K] extends boolean ? K : never;
}[keyof PlanConfig];

/**
 * Guards a route behind a boolean plan feature flag (e.g. `aiStory`,
 * `ideaToVideo`). Returns 403 if the user's plan does not include the feature.
 * Must run after `attachPlan`.
 */
export function requireFeature(feature: BooleanFeature) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const planConfig = req.planConfig ?? PLAN_MAP["free"];
    if (!planConfig[feature]) {
      res.status(403).json({
        error: `Your ${planConfig.name} plan does not include this feature. Please upgrade your plan.`,
        feature,
        plan: planConfig.id,
      });
      return;
    }
    next();
  };
}
