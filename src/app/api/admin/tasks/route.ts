import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const all = await db.select().from(tasks);
  return NextResponse.json({ tasks: all });
}

const CreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  reward: z.number().int().positive(),
  type: z.string().min(1),
  url: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid input" }, { status: 400 });
  }

  const now = Date.now();
  const id = nanoid();
  await db.insert(tasks).values({
    id,
    title: parsed.data.title,
    description: parsed.data.description,
    reward: parsed.data.reward,
    type: parsed.data.type,
    url: parsed.data.url ?? null,
    active: true,
    sortOrder: parsed.data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  reward: z.number().int().positive().optional(),
  url: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;

  const existing = (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
  if (!existing) return NextResponse.json({ error: "task not found" }, { status: 404 });

  await db
    .update(tasks)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
