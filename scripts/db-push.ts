/**
 * Creates all tables directly via SQL DDL against Postgres. We do this
 * instead of relying on a migration-generator tool so the whole stack stays
 * dependency-light and doesn't need any extra CLI wired up before launch.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(connectionString, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      referral_code TEXT NOT NULL,
      referred_by_id TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users(referral_code);`;
  await sql`CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users(referred_by_id);`;
  await sql`CREATE INDEX IF NOT EXISTS users_points_idx ON users(points);`;

  await sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      points_awarded INTEGER NOT NULL,
      created_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_user_idx ON referrals(referred_user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reward INTEGER NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS task_completions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reward INTEGER NOT NULL,
      completed_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS task_completions_task_user_idx ON task_completions(task_id, user_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      metadata TEXT,
      created_at BIGINT NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS point_transactions_user_idx ON point_transactions(user_id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  // --- Migrations for columns added after initial launch ---------------
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_username TEXT;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_label TEXT;`;
  await sql`ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS proof TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    );
  `;

  console.log("Postgres schema created/verified.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
