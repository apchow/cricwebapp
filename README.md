# Pavilion XI 🏏

Community-driven cricket tactical selector — FUTBIN/Transfermarkt meets the back-of-the-notebook
Playing XI debate. **Reputation coins only. No betting, no odds, no crypto, no NFTs, no cash
prizes — ever.** You win bragging rights, tactical IQ and the megaphone.

## Core loop

1. Pick an upcoming match → drag 13 players into an XI builder (11 slots + Impact Player).
2. Validation (overseas cap, min 1 WK, min 5 bowling options, captain/VC rules) → **Lock XI**.
3. A 1200×630 share card (OG/PNG) is generated → send the challenge link to a friend.
4. Friend accepts with their own XI → after the match, higher **matchday impact** wins.
   No friend handy? **Duel PunditBot 9000** — a deterministic simulated matchday settles it instantly.
5. Loser gets 24h **Radio Silence** (room-scoped, never global) and can spend 50 reputation
   coins on a red-tagged **"Paid to Cope"** comment.

## Stack

Next.js 14 (App Router, TS strict) · Tailwind · dnd-kit + Framer Motion · Zustand ·
Prisma + PostgreSQL (Neon) · Upstash Redis (consensus counters + moderation cache) ·
NextAuth (email + Google, plus a handle-only demo login) · @vercel/og share cards ·
Cricsheet-style seeded stats; live rosters behind `LIVE_ROSTER_ENABLED` + `CRICAPI_KEY`.

## Run locally

Requires Docker (or any Postgres 15+ / Redis).

```bash
cd pavilion-xi
cp .env.example .env.local          # defaults work for localhost
npm install
npm run db:up                       # docker: postgres + redis
npm run db:generate
npm run db:migrate                  # applies prisma/migrations (0001 init)
npm run db:seed                     # 14 players, 3 matches, demo duel, 21 consensus picks
npm run dev                         # http://localhost:3000
```

Demo accounts after seeding:

| Handle            | What it shows                                    |
| ----------------- | ------------------------------------------------ |
| `PunditAdmin`     | `/admin/moderation` CRUD + flagged queue         |
| `TacticalGautam`  | Winning duel, megaphone comments                 |
| `Rohan_99`        | 20h Radio Silence + a "Paid to Cope" example     |

Log in at `/login` with any handle (2–24 chars) — this is the no-password demo provider.
Google OAuth activates automatically once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set;
email magic links activate with `EMAIL_SERVER`.

```bash
npm run test    # vitest: validation rules, scoring formula, moderation engine
```

## Pages

| Route                          | What lives there                                  |
| ------------------------------ | ------------------------------------------------- |
| `/`                            | Lobby: matches, consensus teaser, rep leaderboard |
| `/match/[id]/builder`          | The Chalkboard (drag & drop XI, live validation)  |
| `/match/[id]/share/[lineupId]` | Share card, WhatsApp/X/IG copy, Create Duel       |
| `/match/[id]/consensus`        | Consensus meter (SWR, 15s refresh, Crowd XI diff) |
| `/duel/[id]`                   | Head-to-head, scoring breakdown, Gag Order, Cope  |
| `/profile/[handle]`            | Coins, ledger, badges, parody-tag collection      |
| `/admin/moderation`            | Rule CRUD + flagged review queue                  |
| `/api/og/lineup/[lineupId]`    | 1200×630 PNG share card                           |

## Deploy to Vercel (+ Neon + Upstash)

1. **Neon**: create a Postgres branch → copy the pooled connection string.
2. **Upstash**: create a Redis database → copy REST URL + token.
3. Push this repo to GitHub, import into Vercel.
4. Environment variables (Settings → Environment Variables):
   `DATABASE_URL`, `NEXTAUTH_URL=https://your-app.vercel.app`, `NEXTAUTH_SECRET`
   (`npx auth secret`), optionally `GOOGLE_CLIENT_ID/SECRET`, `EMAIL_SERVER`,
   `UPSTASH_REDIS_REST_URL/TOKEN`, `LIVE_ROSTER_ENABLED=false`, `CRICAPI_KEY`,
   `NEXT_PUBLIC_POSTHOG_KEY`.
5. Build command stays `next build`; add to **Project Settings → Root Directory** = `pavilion-xi`
   if the repo root is above it.
6. After the first deploy, run migrations + seed from your machine against the Neon URL:

```bash
DATABASE_URL="postgresql://...pooled...?sslmode=require" npx prisma migrate deploy
DATABASE_URL="postgresql://...pooled...?sslmode=require" npm run db:seed
```

(Or set `postinstall: "prisma migrate deploy"` in package.json if you want zero-touch redeploys.)

### Netlify note

The app is spec'd for Vercel because `@vercel/og` image responses and Vercel's edge rendering are
the smoothest path. On Netlify: `netlify.toml` with `command = "next build"`,
`publish = ".next"`, the `@netlify/plugin-nextjs` build plugin, plus the same env vars works;
the OG endpoint runs on the Node builder function. Neon + Upstash are provider-agnostic.

## Reputation economy (no real money, ever)

| Action                         | Coins        |
| ------------------------------ | ------------ |
| Lock an XI                     | +10          |
| Participate in consensus       | +5           |
| Win a duel                     | +25          |
| Coping Pass ("Paid to Cope")   | −50          |

Mutes are always room-scoped to a single duel — there are no global mutes. The moderation engine
whitelists cricket slang first (`tullabaaz`, `tuk-tuk`, `fraud watch`, `intent merchant`,
`statpadder`), then blocks slurs, family mentions, doxxing and any real player @handles. Share
cards print display names only.

## Non-goals (by design)

Real-money transactions · betting odds or prize pools · crypto/NFTs · storing or auto-tagging
real players' social handles · global mutes · fake stats (all numbers are Cricsheet-style seeds;
live data is explicitly marked STUBBED until the API flag is on).
