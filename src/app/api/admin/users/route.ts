import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users, pointTransactions } from "@/db/schema";
import { eq, like, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "@/lib/admin-guard";
import { getReferralCount } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const search = req.nextUrl.searchParams.get("q");
  const rows = search
    ? await db.select().from(users).where(like(users.username, `%${search}%`))
    : await db.select().from(users).orderBy(desc(users.createdAt)).limit(200);

  const withReferrals = await Promise.all(
    rows.map(async (u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      points: u.points,
      referrals: await getReferralCount(u.id),
      createdAt: u.createdAt,
    }))
  );

  return NextResponse.json({ users: withReferrals });
}

const AdjustSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int(),
  reason: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { userId, amount, reason } = parsed.data;

  const target = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await db
    .update(users)
    .set({ points: target.points + amount, updatedAt: Date.now() })
    .where(eq(users.id, userId));

  await db.insert(pointTransactions).values({
    id: nanoid(),
    userId,
    amount,
    type: "admin_adjustment",
    source: `admin:${admin.username}`,
    metadata: JSON.stringify({ reason }),
    createdAt: Date.now(),
  });

  return NextResponse.json({ ok: true, newBalance: target.points + amount });
}
