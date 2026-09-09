import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/points";
import { db } from "@/db/client";
import { referrals } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // Top 500 is the whole game: only the top 500 by points get selected for
  // wallet collection, so the full cutoff is always fetched here — the
  // terminal UI decides separately how many rows to actually print at once.
  const board = await getLeaderboard(500);

  const withReferrals = await Promise.all(
    board.map(async (row) => {
      const refs = await db.select().from(referrals).where(eq(referrals.referrerId, row.id));
      return { username: row.username, points: row.points, referrals: refs.length };
    })
  );

  return NextResponse.json({ leaderboard: withReferrals });
}
