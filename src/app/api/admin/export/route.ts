import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, taskCompletions, tasks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-guard";
import { getReferralCount } from "@/lib/points";

export const dynamic = "force-dynamic";

/**
 * Exports the top N users by points as CSV, admin-only. Built for the
 * "close registration, snapshot the top 500, open wallet-collection for
 * them" workflow: includes everything needed for manual verification
 * before that — X username, which tasks were completed, and any submitted
 * proof (comment links, etc) — plus rank, points, and referral counts.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "500", 10) || 500, 1), 10000);

  const rows = await db.select().from(users).orderBy(desc(users.points)).limit(limit);
  const allTasks = await db.select().from(tasks);
  const taskTitleById = new Map(allTasks.map((t) => [t.id, t.title]));

  const withDetails = await Promise.all(
    rows.map(async (u) => {
      const referrals = await getReferralCount(u.id);
      const completions = await db.select().from(taskCompletions).where(eq(taskCompletions.userId, u.id));
      const tasksCompleted = completions.map((c) => taskTitleById.get(c.taskId) ?? c.taskId).join(" | ");
      const proofs = completions
        .filter((c) => c.proof)
        .map((c) => `${taskTitleById.get(c.taskId) ?? c.taskId}: ${c.proof}`)
        .join(" | ");
      return { ...u, referrals, tasksCompleted, proofs };
    })
  );

  const header = [
    "rank",
    "username",
    "email",
    "twitter_username",
    "points",
    "referrals",
    "tasks_completed",
    "submitted_proofs",
    "user_id",
    "referral_code",
    "joined_at",
  ];
  const csvRows = [header.join(",")];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  withDetails.forEach((u, i) => {
    const joined = new Date(u.createdAt).toISOString();
    csvRows.push(
      [
        i + 1,
        escape(u.username),
        escape(u.email),
        escape(u.twitterUsername ?? ""),
        u.points,
        u.referrals,
        escape(u.tasksCompleted),
        escape(u.proofs),
        escape(u.id),
        escape(u.referralCode),
        joined,
      ].join(",")
    );
  });

  const csv = csvRows.join("\n");
  const filename = `arcterminals-top-${limit}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
