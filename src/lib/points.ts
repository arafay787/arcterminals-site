import { db } from "@/db/client";
import { users, referrals, pointTransactions, tasks, taskCompletions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getReferralReward } from "./config";

/**
 * All point-awarding logic lives here, server-side only. Nothing in the
 * client is ever trusted to report a point value — every award is computed
 * and written here, and every award leaves an audit row in
 * point_transactions so totals are always reconstructable/verifiable.
 */

async function addPoints(userId: string, amount: number, type: string, source: string, metadata?: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId));
  const user = rows[0];
  if (!user) throw new Error("User not found");

  await db
    .update(users)
    .set({ points: user.points + amount, updatedAt: Date.now() })
    .where(eq(users.id, userId));

  await db.insert(pointTransactions).values({
    id: nanoid(),
    userId,
    amount,
    type,
    source,
    metadata: metadata ?? null,
    createdAt: Date.now(),
  });
}

/**
 * Award a referral. Called once, at the moment a referred user's
 * registration completes. Guards against:
 *  - self-referral (referrer === new user)
 *  - duplicate referral rows (referredUserId is UNIQUE at the DB level, so a
 *    user can only ever be credited as "referred" once, no matter how many
 *    times this function is called for them)
 */
export async function awardReferral(referrerId: string, referredUserId: string, referralCode: string) {
  if (referrerId === referredUserId) {
    return { awarded: false, reason: "self_referral" as const };
  }

  const existingRows = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId));
  if (existingRows[0]) {
    return { awarded: false, reason: "already_referred" as const };
  }

  const reward = await getReferralReward();

  try {
    await db.insert(referrals).values({
      id: nanoid(),
      referrerId,
      referredUserId,
      referralCode,
      pointsAwarded: reward,
      createdAt: Date.now(),
    });
  } catch {
    // Unique constraint hit (race) - someone else already credited this user.
    return { awarded: false, reason: "already_referred" as const };
  }

  await addPoints(referrerId, reward, "referral", `referral:${referredUserId}`);

  return { awarded: true as const, reward };
}

/**
 * Complete a task for a user. Guards against duplicate claims via the
 * task_completions UNIQUE(task_id, user_id) constraint - the insert simply
 * throws/no-ops if already claimed, so this is safe under concurrent
 * requests too, not just sequential ones.
 */
export async function completeTask(userId: string, taskId: string, proof?: string) {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const task = taskRows[0];
  if (!task || !task.active) {
    return { completed: false, reason: "task_not_found" as const };
  }

  if (task.requiresProof && !proof?.trim()) {
    return { completed: false, reason: "proof_required" as const };
  }

  const existingRows = await db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.userId, userId)));
  if (existingRows[0]) {
    return { completed: false, reason: "already_completed" as const };
  }

  try {
    await db.insert(taskCompletions).values({
      id: nanoid(),
      taskId,
      userId,
      reward: task.reward,
      proof: proof?.trim() || null,
      completedAt: Date.now(),
    });
  } catch {
    return { completed: false, reason: "already_completed" as const };
  }

  // The follow task's "proof" is the user's X username - also save it on
  // their profile so it's reusable (shown, exported) without re-asking.
  if (task.type === "follow_x" && proof?.trim()) {
    await db.update(users).set({ twitterUsername: proof.trim().replace(/^@/, "") }).where(eq(users.id, userId));
  }

  await addPoints(userId, task.reward, "task", taskId);

  return { completed: true as const, reward: task.reward };
}

export async function getReferralCount(userId: string): Promise<number> {
  const rows = await db.select().from(referrals).where(eq(referrals.referrerId, userId));
  return rows.length;
}

export async function getLeaderboard(limit = 50) {
  return db
    .select({
      id: users.id,
      username: users.username,
      points: users.points,
    })
    .from(users)
    .orderBy(desc(users.points))
    .limit(limit);
}

export async function getUserRank(userId: string): Promise<number> {
  const all = await db
    .select({ id: users.id, points: users.points })
    .from(users)
    .orderBy(desc(users.points));
  const idx = all.findIndex((u) => u.id === userId);
  return idx === -1 ? -1 : idx + 1;
}
