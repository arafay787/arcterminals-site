import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getReferralCount, getUserRank } from "@/lib/points";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const [referralCount, rank] = await Promise.all([
    getReferralCount(user.id),
    getUserRank(user.id),
  ]);

  return NextResponse.json({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    points: user.points,
    referrals: referralCount,
    rank,
    referralCode: user.referralCode,
    referralLink: `${process.env.NEXT_PUBLIC_SITE_URL}/r/${user.referralCode}`,
    createdAt: user.createdAt,
  });
}
