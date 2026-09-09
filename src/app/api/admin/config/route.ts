import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { getConfigValue, setConfigValue } from "@/lib/config";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const referralReward = await getConfigValue("REFERRAL_REWARD");
  return NextResponse.json({ REFERRAL_REWARD: referralReward });
}

const Schema = z.object({
  key: z.literal("REFERRAL_REWARD"),
  value: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  await setConfigValue(parsed.data.key, parsed.data.value);
  return NextResponse.json({ ok: true });
}
