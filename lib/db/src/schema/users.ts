import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseUid: text("supabase_uid").unique(),
  email: text("email").notNull().unique(),
  mobileNumber: text("mobile_number").unique(),
  mobileVerified: boolean("mobile_verified").notNull().default(false),
  username: text("username"),
  currentPlan: text("current_plan").notNull().default("free"),
  credits: integer("credits").notNull().default(0),
  freeCreditsLastClaimed: timestamp("free_credits_last_claimed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
