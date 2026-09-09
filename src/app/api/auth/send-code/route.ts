import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users, emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationCode } from "@/lib/email";

const Schema = z.object({ email: z.string().email() });

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const existingUser = await db.select().from(users).where(eq(users.email, email));
  if (existingUser[0]) {
    return NextResponse.json({ error: "email already registered" }, { status: 409 });
  }

  // Basic resend cooldown: don't allow re-sending more than once every 30s.
  const existing = await db.select().from(emailVerifications).where(eq(emailVerifications.email, email));
  const now = Date.now();
  if (existing[0] && now - existing[0].createdAt < 30_000) {
    return NextResponse.json({ error: "please wait before requesting another code" }, { status: 429 });
  }

  const code = generateCode();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  try {
    if (existing[0]) {
      await db
        .update(emailVerifications)
        .set({ code, expiresAt, attempts: 0, createdAt: now })
        .where(eq(emailVerifications.email, email));
    } else {
      await db.insert(emailVerifications).values({ email, code, expiresAt, attempts: 0, createdAt: now });
    }

    await sendVerificationCode(email, code);
  } catch (err) {
    console.error("send-code failed:", err);
    return NextResponse.json({ error: "could not send verification email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
