import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users, pointTransactions, taskCompletions, referrals } from "@/db/schema";
import { eq, like, desc, or } from "drizzle-orm";
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

const RenameSchema = z.object({
  action: z.literal("rename"),
  username: z.string().min(1),
  newUsername: z
    .string()
    .min(3, "username too short")
    .max(20, "username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, underscore only"),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);

  // Two different shapes share this endpoint: a point adjustment, or a
  // rename (discriminated by the "action" field).
  if (body?.action === "rename") {
    const parsed = RenameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "invalid input" },
        { status: 400 }
      );
    }
    const { username, newUsername } = parsed.data;

    const target = (await db.select().from(users).where(eq(users.username, username)))[0];
    if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

    const clash = (await db.select().from(users).where(eq(users.username, newUsername)))[0];
    if (clash) return NextResponse.json({ error: "that username is already taken" }, { status: 409 });

    const newReferralCode = newUsername.toLowerCase();
    const codeClash = (await db.select().from(users).where(eq(users.referralCode, newReferralCode)))[0];
    if (codeClash) return NextResponse.json({ error: "that username is already taken" }, { status: 409 });

    await db
      .update(users)
      .set({ username: newUsername, referralCode: newReferralCode, updatedAt: Date.now() })
      .where(eq(users.id, target.id));

    return NextResponse.json({
      renamed: true,
      oldUsername: username,
      newUsername,
      newReferralLink: `${process.env.NEXT_PUBLIC_SITE_URL}/r/${newReferralCode}`,
    });
  }

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

const DeleteSchema = z.object({ username: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const username = req.nextUrl.searchParams.get("username");
  const parsed = DeleteSchema.safeParse({ username });
  if (!parsed.success) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const target = (await db.select().from(users).where(eq(users.username, parsed.data.username)))[0];
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (target.role === "admin") {
    if (target.id === admin.id) {
      return NextResponse.json(
        { error: "cannot delete your own account while logged in as it" },
        { status: 403 }
      );
    }
    const adminCount = (await db.select().from(users).where(eq(users.role, "admin"))).length;
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "cannot delete the only remaining admin account" },
        { status: 403 }
      );
    }
  }

  // Clean up everything tied to this user before removing the row itself.
  await db.delete(pointTransactions).where(eq(pointTransactions.userId, target.id));
  await db.delete(taskCompletions).where(eq(taskCompletions.userId, target.id));
  await db
    .delete(referrals)
    .where(or(eq(referrals.referrerId, target.id), eq(referrals.referredUserId, target.id)));
  // If this user referred others, don't leave their "referred by" pointer
  // dangling at a now-deleted id.
  await db.update(users).set({ referredById: null }).where(eq(users.referredById, target.id));
  await db.delete(users).where(eq(users.id, target.id));

  return NextResponse.json({ deleted: true, username: target.username });
}
