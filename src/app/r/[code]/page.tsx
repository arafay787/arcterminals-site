import type { Metadata } from "next";
import Terminal from "@/components/Terminal";
import { db } from "@/db/client";
import { users, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getReferralCount } from "@/lib/points";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arcterminals.xyz";
const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";

async function getReferrer(code: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.referralCode, code.toLowerCase()));
  const user = rows[0];
  if (!user) return null;
  const count = await getReferralCount(user.id);
  return { username: user.username, points: user.points, referrals: count };
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const referrer = await getReferrer(params.code);
  if (!referrer) {
    return { title: `${projectName} — TERMINAL` };
  }

  const title = `@${referrer.username} on ${projectName}`;
  const description = `${referrer.points.toLocaleString()} points · ${referrer.referrals} referrals. Join the network.`;
  const ogImage = `${siteUrl}/api/og/${referrer.username}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/r/${params.code}`,
      siteName: projectName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ReferralPage({ params }: { params: { code: string } }) {
  const referrer = await getReferrer(params.code);
  return <Terminal referralContext={referrer} referralCode={params.code} />;
}
