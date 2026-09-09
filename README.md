# ARC TERMINALS — Terminal-native referral platform

The whole site *is* the terminal — boot sequence, registration, profile,
tasks, leaderboard, referral sharing, and admin, all rendered as a CRT
terminal session. No conventional forms, cards, or dashboards anywhere.

Built with Next.js 14 (App Router) + TypeScript + Tailwind, Drizzle ORM,
and **Postgres** (chosen over SQLite because Vercel's serverless functions
reset their filesystem on every request — SQLite would silently lose all
data in production). Every point/referral award is computed and written
server-side only, with a full audit trail.

This has been tested end-to-end against a real running Postgres instance
— registration, referrals, task claims, the leaderboard, admin actions,
and the dynamic share-card image generation all verified working, not
just typechecked.

---

## Before you start

You'll need, all free at the tier you need for launch:

1. **Node.js** installed on your computer (v18 or newer) — nodejs.org
2. A **GitHub** account (to hold the code so Vercel can deploy it)
3. A **Vercel** account (hosting) — vercel.com, sign up with GitHub
4. A **Neon** account (Postgres database) — neon.tech, free tier is plenty
5. Access to your domain's DNS settings (wherever you bought
   `arcterminals.xyz`)

---

## Step 1 — Get a Postgres database (Neon)

1. Go to neon.tech, sign up, create a new project (call it `arcterminals`).
2. On the project dashboard, find the **connection string** — it looks
   like `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`.
   Copy it. You'll use this exact string as `DATABASE_URL` in step 3 and
   step 5.

That's the whole database setup — Neon handles backups, scaling, and
uptime for you.

---

## Step 2 — Get the code onto your computer

1. Unzip the project folder you were given.
2. Open a terminal (Terminal.app on Mac, or Command Prompt/PowerShell on
   Windows, or just your regular terminal on Linux) and `cd` into the
   unzipped folder.
3. Install dependencies:
   ```bash
   npm install
   ```

---

## Step 3 — Configure and test locally

1. Open the `.env` file in the project folder in any text editor.
2. Replace the `DATABASE_URL` line with your real Neon connection string
   from Step 1.
3. Replace `JWT_SECRET` with a long random string — anything works, e.g.
   run `openssl rand -hex 32` in your terminal and paste the result.
4. Save the file.
5. Create the database tables:
   ```bash
   npm run db:push
   ```
6. Create your admin account + example tasks:
   ```bash
   SEED_ADMIN_USERNAME=youradminname SEED_ADMIN_PASSWORD='a-real-strong-password' npm run db:seed
   ```
   (Pick your own username/password here — this becomes your real admin
   login, so don't use the `changeme123` default for the live site.)
7. Run it locally to make sure everything works:
   ```bash
   npm run dev
   ```
8. Open http://localhost:3000 in your browser. You should see the boot
   sequence, and be able to type `register` and create a test account.
9. Visit http://localhost:3000/admin, log in with the admin
   username/password from step 6, and confirm you can see the admin
   console.

If all of that works, you're ready to deploy — everything from here on
is just "put this same code on the internet."

---

## Step 4 — Push the code to GitHub

Vercel deploys from a GitHub repository, so the code needs to live there
first.

1. Go to github.com, create a new **private** repository (e.g.
   `arcterminals-site`).
2. In your project folder terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/arcterminals-site.git
   git push -u origin main
   ```
   (GitHub will show you these exact commands on the new repo's page —
   use theirs if slightly different, it's the same idea.)

Note: `.env` is already excluded via `.gitignore`, so your database
password and JWT secret will NOT be uploaded to GitHub. Good — you'll
enter them directly into Vercel instead, in the next step.

---

## Step 5 — Deploy to Vercel

1. Go to vercel.com, click **Add New → Project**.
2. Import the GitHub repository you just pushed.
3. Vercel will auto-detect it's a Next.js app — leave the build settings
   as default.
4. Before clicking Deploy, open **Environment Variables** and add these
   four (same values as your local `.env`):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `JWT_SECRET` | your random secret string |
   | `NEXT_PUBLIC_SITE_URL` | `https://arcterminals.xyz` |
   | `NEXT_PUBLIC_PROJECT_NAME` | `ARC TERMINALS` |

5. Click **Deploy**. Wait ~1-2 minutes.
6. Vercel gives you a temporary URL like `arcterminals-site.vercel.app` —
   open it and confirm the terminal boots. (The database tables and
   admin account already exist from Step 3, since you pushed/seeded the
   same Neon database Vercel is now using.)

---

## Step 6 — Point arcterminals.xyz at Vercel

1. In the Vercel project, go to **Settings → Domains**, type
   `arcterminals.xyz`, click Add.
2. Vercel will show you either:
   - an **A record** (an IP address) to add, or
   - Vercel's **nameservers** to switch to
3. Go to wherever you registered `arcterminals.xyz` (GoDaddy, Namecheap,
   Google Domains, etc.), find the DNS settings, and add exactly what
   Vercel showed you.
4. DNS changes can take anywhere from a few minutes to a few hours to
   take effect. Vercel's domain page will show a green checkmark once
   it's live.
5. Once it's green, visit `https://arcterminals.xyz` — the real domain
   now serves your terminal.

---

## Step 7 — Final launch checklist

Go through these on the **live** `arcterminals.xyz` site, not localhost:

- [ ] Boot sequence plays and looks right
- [ ] `register` creates a real account
- [ ] Log out, `login` works with that account
- [ ] Visit `arcterminals.xyz/r/<your-admin-username>`, confirm the
      "INCOMING CONNECTION" referral boot sequence appears
- [ ] Register a second test account through that referral link, confirm
      the first account's points/referral count went up (`profile`
      command)
- [ ] `tasks`, then `complete 1` — confirm points update
- [ ] `leaderboard` shows both accounts correctly
- [ ] Paste `https://arcterminals.xyz/r/<username>` into a new X/Twitter
      post (don't post it — X shows the preview before you post) and
      confirm the terminal-style share card image appears
- [ ] Log into `/admin` with your real admin credentials, confirm you
      can see users and change `REFERRAL_REWARD`
- [ ] Delete/adjust your test accounts' points via admin so launch day
      leaderboard starts clean (or just leave a couple of real early
      testers — up to you)

Once every box is checked, you're live. Share the domain.

---

## Day-to-day admin

Log into `arcterminals.xyz/admin` with your admin account. Commands:

```
HELP
USERS [query]                 List / search users
ADJUST <userId> <amt> <why>   Adjust a user's points (amt can be negative)
TASKS                         List all tasks
CREATETASK "Title" "Description" reward type [url]
TOGGLETASK <taskId>           Enable/disable a task
CONFIG                        View current REFERRAL_REWARD
SETREWARD <amount>            Change REFERRAL_REWARD (takes effect instantly, no redeploy)
CLEAR
```

To add more admin accounts later, run the seed command again locally
with a different username, pointed at the same production `DATABASE_URL`:
```bash
SEED_ADMIN_USERNAME=secondadmin SEED_ADMIN_PASSWORD='another-password' npm run db:seed
```

---

## How the referral flow works (for reference)

1. Someone visits `/r/<username>` (their friend's referral link). That
   page sets an httpOnly cookie naming the referrer, before any
   registration happens — so it survives even if they close the tab and
   come back within 7 days.
2. When they register, the server reads that cookie, resolves the
   referrer, and — server-side only — awards `REFERRAL_REWARD` points to
   the referrer, with an audit row in `point_transactions`.
3. Self-referrals are a no-op. A user can only ever be credited as
   "referred" once, enforced by a database UNIQUE constraint — holds even
   under concurrent requests, not just app-level logic.

Task completion works the same way: a UNIQUE(task_id, user_id)
constraint makes double-claiming impossible even under a race.

## Dynamic X/Twitter link previews

`/r/<username>` has real Open Graph + Twitter Card metadata, including
`og:image` pointing at `/api/og/<username>` — a route that renders an
actual PNG on the fly (via Next's built-in image generation) styled as a
terminal share card, using that user's live points/referrals/rank. When
someone pastes the link into X, X's crawler fetches that image directly
— no manual upload, always current.

---

## Project structure

```
src/
  app/
    page.tsx                    Main terminal entry
    r/[code]/page.tsx           Referral landing (dynamic OG metadata)
    admin/page.tsx               Admin console (server-guarded)
    api/
      auth/{register,login,logout}/route.ts
      me/route.ts                Current user + live stats
      referral/attribute/route.ts  Sets referral cookie pre-registration
      tasks/route.ts             List tasks (per-user completion status)
      tasks/complete/route.ts    Claim a task (server-authoritative)
      leaderboard/route.ts       Live rankings
      og/[username]/route.tsx    Dynamic share-card PNG generation
      admin/{users,tasks,config}/route.ts   Admin-only, role-guarded
  components/
    Terminal.tsx                 The whole boot/auth/command engine
    AdminTerminal.tsx            Admin console UI
  db/
    schema.ts                    Drizzle schema (Postgres)
    client.ts                    DB connection singleton
  lib/
    auth.ts                      Sessions, password hashing, referral cookie
    points.ts                    Server-authoritative points/referral logic
    config.ts                    DB-backed runtime config (REFERRAL_REWARD)
    admin-guard.ts                requireAdmin() helper
scripts/
  db-push.ts                     Creates Postgres tables
  seed.ts                        Creates admin user + example tasks
```
