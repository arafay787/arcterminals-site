import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  signSession,
  setSessionCookie,
  getReferralAttribution,
  clearReferralAttribution,
} from "@/lib/auth";
import { awardReferral } from "@/lib/points";

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "username too short")
    .max(20, "username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, underscore only"),
  email: z.string().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }
  const { username, email, password } = parsed.data;

  const usernameTaken = (await db.select().from(users).where(eq(users.username, username)))[0];
  if (usernameTaken) {
    return NextResponse.json({ error: "username already taken" }, { status: 409 });
  }
  const emailTaken = (await db.select().from(users).where(eq(users.email, email)))[0];
  if (emailTaken) {
    return NextResponse.json({ error: "email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const userId = nanoid();
  const referralCode = username.toLowerCase();
  const now = Date.now();

  const attributedCode = getReferralAttribution();
  let referredById: string | null = null;
  if (attributedCode) {
    const referrer = (await db.select().from(users).where(eq(users.referralCode, attributedCode)))[0];
    if (referrer) referredById = referrer.id;
  }

  try {
    await db.insert(users).values({
      id: userId,
      username,
      email,
      passwordHash,
      role: "user",
      referralCode,
      referredById,
      points: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return NextResponse.json({ error: "username or email already taken" }, { status: 409 });
  }

  if (referredById) {
    await awardReferral(referredById, userId, attributedCode!);
    clearReferralAttribution();
  }

  const token = signSession({ userId, username, role: "user" });
  setSessionCookie(token);

  return NextResponse.json({
    userId,
    username,
    referralCode,
    referralLink: `${process.env.NEXT_PUBLIC_SITE_URL}/r/${referralCode}`,
  });
}
