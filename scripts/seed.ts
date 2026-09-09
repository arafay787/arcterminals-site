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

  // --- Example tasks ----------------------------------------------------
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM tasks`;
  if (count === 0) {
    const tasks = [
      {
        title: "FOLLOW PROJECT ON X",
        description: "Follow @ArcTerminals on X to stay updated on mainnet launch.",
        reward: 25,
        type: "follow_x",
        url: "https://x.com/ArcTerminals",
        sortOrder: 1,
      },
      {
        title: "JOIN COMMUNITY",
        description: "Join the ArcTerminals Discord server.",
        reward: 15,
        type: "join_community",
        url: "https://discord.gg/arcterminals",
        sortOrder: 2,
      },
      {
        title: "SHARE REFERRAL LINK",
        description: "Post your referral link on X.",
        reward: 50,
        type: "share_link",
        url: null,
        sortOrder: 3,
      },
    ];
    for (const t of tasks) {
      await sql`
        INSERT INTO tasks (id, title, description, reward, type, url, active, sort_order, created_at, updated_at)
        VALUES (${nanoid()}, ${t.title}, ${t.description}, ${t.reward}, ${t.type}, ${t.url}, TRUE, ${t.sortOrder}, ${now}, ${now})
      `;
    }
    console.log(`Created ${tasks.length} example tasks.`);
  } else {
    console.log(`${count} task(s) already exist, skipping.`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
