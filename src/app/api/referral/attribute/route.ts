import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setReferralAttribution } from "@/lib/auth";

const Schema = z.object({ code: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const referrer = (
    await db.select().from(users).where(eq(users.referralCode, parsed.data.code.toLowerCase()))
  )[0];

  if (!referrer) {
    return NextResponse.json({ error: "unknown referral code" }, { status: 404 });
  }

  setReferralAttribution(referrer.referralCode);

  const refCount = (await db.select().from(referrals).where(eq(referrals.referrerId, referrer.id))).length;

  return NextResponse.json({
    username: referrer.username,
    referrals: refCount,
  });
}
