import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { completeTask } from "@/lib/points";

const Schema = z.object({ taskId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const result = await completeTask(user.id, parsed.data.taskId);
  if (!result.completed) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ completed: true, reward: result.reward });
}
