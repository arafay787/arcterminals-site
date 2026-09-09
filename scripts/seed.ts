import "dotenv/config";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(connectionString, { max: 1 });

  const now = Date.now();

  // --- Admin user ---------------------------------------------------
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const existingAdmin = await sql`SELECT id FROM users WHERE username = ${adminUsername}`;

  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await sql`
      INSERT INTO users (id, username, email, password_hash, role, referral_code, referred_by_id, points, created_at, updated_at)
      VALUES (${nanoid()}, ${adminUsername}, ${adminUsername + "@arcterminals.xyz"}, ${passwordHash}, 'admin', ${adminUsername}, NULL, 0, ${now}, ${now})
    `;
    console.log(`Created admin user "${adminUsername}" / password "${adminPassword}" — CHANGE THIS PASSWORD.`);
  } else {
    console.log(`Admin user "${adminUsername}" already exists, skipping.`);
  }

  // --- Config ---------------------------------------------------------
  const existingConfig = await sql`SELECT key FROM config WHERE key = 'REFERRAL_REWARD'`;
  if (existingConfig.length === 0) {
    await sql`INSERT INTO config (key, value) VALUES ('REFERRAL_REWARD', '10')`;
    console.log("Set REFERRAL_REWARD = 10");
  }

  // --- Tasks: upsert by `type`, so re-running this safely updates an -----
  // --- already-live deployment instead of only seeding an empty one. -----
  // NOTE: the like/repost/comment URLs below are placeholders pointing at
  // the project's profile — update them via the admin `SETURL` command
  // once there's a real pinned launch post to point at.
  const desiredTasks = [
    {
      type: "follow_x",
      title: "FOLLOW PROJECT ON X",
      description: "Follow @ArcTerminals on X.",
      reward: 10,
      url: "https://x.com/ArcTerminals",
      sortOrder: 1,
      requiresProof: true,
      proofLabel: "Enter your X (Twitter) username",
    },
    {
      type: "like_x",
      title: "LIKE THE POST",
      description: "Like the pinned post on X.",
      reward: 5,
      url: "https://x.com/ArcTerminals",
      sortOrder: 2,
      requiresProof: false,
      proofLabel: null as string | null,
    },
    {
      type: "repost_x",
      title: "REPOST",
      description: "Repost the pinned post on X.",
      reward: 5,
      url: "https://x.com/ArcTerminals",
      sortOrder: 3,
      requiresProof: false,
      proofLabel: null as string | null,
    },
    {
      type: "comment_x",
      title: "COMMENT",
      description: "Comment on the pinned post on X.",
      reward: 15,
      url: "https://x.com/ArcTerminals",
      sortOrder: 4,
      requiresProof: true,
      proofLabel: "Paste your comment link",
    },
  ];

  for (const t of desiredTasks) {
    const existing = await sql`SELECT id FROM tasks WHERE type = ${t.type}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO tasks (id, title, description, reward, type, url, active, sort_order, requires_proof, proof_label, created_at, updated_at)
        VALUES (${nanoid()}, ${t.title}, ${t.description}, ${t.reward}, ${t.type}, ${t.url}, TRUE, ${t.sortOrder}, ${t.requiresProof}, ${t.proofLabel}, ${now}, ${now})
      `;
      console.log(`Created task: ${t.title}`);
    } else {
      await sql`
        UPDATE tasks SET
          title = ${t.title},
          description = ${t.description},
          reward = ${t.reward},
          sort_order = ${t.sortOrder},
          requires_proof = ${t.requiresProof},
          proof_label = ${t.proofLabel},
          active = TRUE,
          updated_at = ${now}
        WHERE type = ${t.type}
      `;
      console.log(`Updated task: ${t.title}`);
    }
  }

  // Retire the old generic tasks that are being replaced by the granular
  // follow/like/repost/comment set and the always-visible referral info
  // block (deactivate rather than delete, so history/audit isn't lost).
  const retiredTypes = ["share_link"];
  for (const type of retiredTypes) {
    const result = await sql`UPDATE tasks SET active = FALSE, updated_at = ${now} WHERE type = ${type} AND active = TRUE`;
    if (result.count > 0) console.log(`Retired old task of type "${type}"`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
