import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tasks, taskCompletions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const activeTasks = await db.select().from(tasks).where(eq(tasks.active, true));
  const completions = await db.select().from(taskCompletions).where(eq(taskCompletions.userId, user.id));
  const completedIds = new Set(completions.map((c) => c.taskId));

  const result = activeTasks
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      reward: t.reward,
      type: t.type,
      url: t.url,
      status: completedIds.has(t.id) ? "COMPLETE" : "PENDING",
    }));

  return NextResponse.json({ tasks: result });
}
