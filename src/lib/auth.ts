import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your .env file.");
}

const SESSION_COOKIE = "arcterm_session";
const SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const rows = await db.select().from(users).where(eq(users.id, session.userId));
  return rows[0] ?? null;
}

const REFERRAL_ATTRIBUTION_COOKIE = "arcterm_ref";

export function setReferralAttribution(referralCode: string) {
  cookies().set(REFERRAL_ATTRIBUTION_COOKIE, referralCode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function getReferralAttribution(): string | null {
  return cookies().get(REFERRAL_ATTRIBUTION_COOKIE)?.value ?? null;
}

export function clearReferralAttribution() {
  cookies().delete(REFERRAL_ATTRIBUTION_COOKIE);
}

// ---- Email verification token (short-lived, proves a code was verified) --
// Issued once /api/auth/verify-code confirms the right code for an email.
// Registration requires this token so the email step can't be skipped by
// calling /api/auth/register directly.

interface EmailVerifyPayload {
  purpose: "email_verify";
  email: string;
}

export function signEmailVerifyToken(email: string): string {
  return jwt.sign({ purpose: "email_verify", email } satisfies EmailVerifyPayload, JWT_SECRET!, {
    expiresIn: "15m",
  });
}

export function verifyEmailVerifyToken(token: string, expectedEmail: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as EmailVerifyPayload;
    return payload.purpose === "email_verify" && payload.email.toLowerCase() === expectedEmail.toLowerCase();
  } catch {
    return false;
  }
}
