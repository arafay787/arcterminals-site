export const dynamic = "force-dynamic";

import { ImageResponse } from "next/og";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getReferralCount, getUserRank } from "@/lib/points";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const user = (await db.select().from(users).where(eq(users.username, params.username)))[0];

  if (!user) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#050705",
            color: "#39ff6a",
            fontSize: 36,
            fontFamily: "monospace",
          }}
        >
          USER NOT FOUND
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const [referrals, rank] = await Promise.all([getReferralCount(user.id), getUserRank(user.id)]);
  const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "arcterminals.xyz").replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#050705",
          color: "#39ff6a",
          fontFamily: "monospace",
          padding: "56px 64px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, opacity: 0.6 }}>
          <div style={{ display: "flex" }}>{projectName}</div>
          <div style={{ display: "flex" }}>TERMINAL://PROFILE</div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 30, opacity: 0.85 }}>
          {"+" + "-".repeat(46) + "+"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 20, gap: 14 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
            @{user.username}
          </div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.75, marginTop: 8 }}>
            STATUS: ACTIVE
          </div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>
            POINTS: {user.points.toLocaleString()}
          </div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>
            REFERRALS: {referrals}
          </div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>
            RANK: #{rank > 0 ? String(rank).padStart(3, "0") : "---"}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 30, opacity: 0.85 }}>
          {"+" + "-".repeat(46) + "+"}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 24, opacity: 0.9 }}>
          {"JOIN THE NETWORK  ->  " + siteUrl + "/r/" + user.referralCode}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
