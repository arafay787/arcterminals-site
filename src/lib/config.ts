import { db } from "@/db/client";
import { config } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  REFERRAL_REWARD: "10",
  PROJECT_NAME: "ARC TERMINALS",
};

export async function getConfigValue(key: keyof typeof DEFAULTS): Promise<string> {
  const rows = await db.select().from(config).where(eq(config.key, key));
  return rows[0]?.value ?? DEFAULTS[key];
}

export async function setConfigValue(key: string, value: string) {
  const rows = await db.select().from(config).where(eq(config.key, key));
  if (rows[0]) {
    await db.update(config).set({ value }).where(eq(config.key, key));
  } else {
    await db.insert(config).values({ key, value });
  }
}

export async function getReferralReward(): Promise<number> {
  const v = await getConfigValue("REFERRAL_REWARD");
  return parseInt(v, 10) || 10;
}
