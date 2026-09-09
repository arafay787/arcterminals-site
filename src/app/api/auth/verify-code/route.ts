import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signEmailVerifyToken } from "@/lib/auth";

const Schema = z.object({ email: z.string().email(), code: z.string().min(6).max(6) });

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const rows = await db.select().from(emailVerifications).where(eq(emailVerifications.email, email));
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "no code requested for this email" }, { status: 404 });
  }
  if (Date.now() > row.expiresAt) {
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "too many attempts - request a new code" }, { status: 429 });
  }

  if (row.code !== parsed.data.code) {
    await db
      .update(emailVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerifications.email, email));
    return NextResponse.json({ error: "incorrect code" }, { status: 401 });
  }

  // Correct - consume it so it can't be reused, issue a short-lived token
  // that /api/auth/register requires to actually create the account.
  await db.delete(emailVerifications).where(eq(emailVerifications.email, email));
  const verifyToken = signEmailVerifyToken(email);

  return NextResponse.json({ verified: true, verifyToken });
}
