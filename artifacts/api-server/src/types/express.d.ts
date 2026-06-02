import type { usersTable } from "@workspace/db";
import type { PlanConfig } from "../config/plans";

declare global {
  namespace Express {
    interface Request {
      user?: typeof usersTable.$inferSelect;
      planConfig?: PlanConfig;
    }
  }
}

export {};
