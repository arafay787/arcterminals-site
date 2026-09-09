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
  const completedById = new Map(completions.map((c) => [c.taskId, c]));

  const result = activeTasks
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => {
      const completion = completedById.get(t.id);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        reward: t.reward,
        type: t.type,
        url: t.url,
        requiresProof: t.requiresProof,
        proofLabel: t.proofLabel,
        status: completion ? "COMPLETE" : "PENDING",
        proof: completion?.proof ?? null,
      };
    });

  return NextResponse.json({ tasks: result, twitterUsername: user.twitterUsername });
}
