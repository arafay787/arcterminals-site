// ArcTerminals data model — Postgres.
// Points/rewards use plain integer (fine up to ~2.1 billion). Timestamps are
// stored as epoch-milliseconds in bigint columns (JS numbers safely represent
// integers up to 2^53, well past any realistic epoch-ms value), which keeps
// the application code identical to before — every call site just does
// Date.now() and compares numbers, no Date-object plumbing needed.

import { pgTable, text, integer, bigint, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"), // "user" | "admin"

    referralCode: text("referral_code").notNull(),
    referredById: text("referred_by_id"),

    points: integer("points").notNull().default(0),
    twitterUsername: text("twitter_username"),

    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    referralCodeIdx: uniqueIndex("users_referral_code_idx").on(t.referralCode),
    referredByIdx: index("users_referred_by_idx").on(t.referredById),
    pointsIdx: index("users_points_idx").on(t.points),
  })
);

export const referrals = pgTable(
  "referrals",
  {
    id: text("id").primaryKey(),
    referrerId: text("referrer_id").notNull(),
    referredUserId: text("referred_user_id").notNull(),
    referralCode: text("referral_code").notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    referredUserIdx: uniqueIndex("referrals_referred_user_idx").on(t.referredUserId),
    referrerIdx: index("referrals_referrer_idx").on(t.referrerId),
  })
);

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reward: integer("reward").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresProof: boolean("requires_proof").notNull().default(false),
  proofLabel: text("proof_label"), // e.g. "Paste your comment link"
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const taskCompletions = pgTable(
  "task_completions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    userId: text("user_id").notNull(),
    reward: integer("reward").notNull(),
    proof: text("proof"), // e.g. submitted comment link or X username
    completedAt: bigint("completed_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    uniqueClaim: uniqueIndex("task_completions_task_user_idx").on(t.taskId, t.userId),
  })
);

export const pointTransactions = pgTable(
  "point_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    metadata: text("metadata"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("point_transactions_user_idx").on(t.userId),
  })
);

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
