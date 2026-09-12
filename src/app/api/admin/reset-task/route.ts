import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users, tasks, taskCompletions, pointTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const Schema = z.object({ username: z.string().min(1), taskId: z.string().min(1) });

/**
 * Fully undoes one user's completion of one task: deletes their submitted
 * proof (X username / comment link), removes the completion record, claws
 * back the points that completion awarded (with an audited point_transaction,
 * same as ADJUST), and puts the task back to PENDING for them so they can
 * resubmit. If the task is the follow task, also clears the X username
 * stored on their profile, since it was sourced from this same submission.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { username, taskId } = parsed.data;

  const target = (await db.select().from(users).where(eq(users.username, username)))[0];
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)))[0];
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const completion = (
    await db
      .select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.userId, target.id)))
  )[0];
  if (!completion) {
    return NextResponse.json({ error: "user has not completed this task" }, { status: 404 });
  }

  const newPoints = Math.max(0, target.points - completion.reward);

  await db
    .update(users)
    .set({
      points: newPoints,
      updatedAt: Date.now(),
      ...(task.type === "follow_x" ? { twitterUsername: null } : {}),
    })
    .where(eq(users.id, target.id));

  await db.insert(pointTransactions).values({
    id: nanoid(),
    userId: target.id,
    amount: -completion.reward,
    type: "admin_adjustment",
    source: `admin:${admin.username}:reset_task:${task.title}`,
    metadata: JSON.stringify({ reason: "task reset by admin", taskId, previousProof: completion.proof }),
    createdAt: Date.now(),
  });

  await db.delete(taskCompletions).where(eq(taskCompletions.id, completion.id));

  return NextResponse.json({
    reset: true,
    username: target.username,
    task: task.title,
    pointsRemoved: completion.reward,
    newPoints,
  });
}
