import { NextResponse } from "next/server";
import { getConfigValue } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Public, read-only: the current referral point rate, so the UI can show
 *  an accurate "+N points per referral" message without guessing/hardcoding. */
export async function GET() {
  const value = await getConfigValue("REFERRAL_REWARD");
  return NextResponse.json({ value });
}
