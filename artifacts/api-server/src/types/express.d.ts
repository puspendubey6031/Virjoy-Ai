import type { usersTable } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: typeof usersTable.$inferSelect;
    }
  }
}

export {};
