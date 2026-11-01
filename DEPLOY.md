# Deploying Pavilion XI to Netlify

Pavilion XI (now including the PunditBot solo-duel engine merged in from The Pundit Arena) needs
one external service and two secrets. Redis and PostHog are optional — the app degrades gracefully
without them.

## One-time services

1. **Neon Postgres (free tier)** — [console.neon.tech](https://console.neon.tech) → create project →
   copy the pooled connection string.
2. *(Optional)* **Upstash Redis (free tier)** — only for high-traffic consensus counters.

## Netlify setup

1. Push this folder to GitHub → **Add new site → Import an existing project**.
2. Netlify auto-detects Next.js from `netlify.toml` (`npm run build`, publish `.next`,
   `@netlify/plugin-nextjs`; `prisma generate` runs on `postinstall`).
3. Site configuration → Environment variables:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | yes |
| `NEXTAUTH_SECRET` | output of `npx auth secret` | yes |
| `NEXTAUTH_URL` | `https://<yoursite>.netlify.app` | yes |
| `EMAIL_SERVER` / `EMAIL_FROM` | SMTP for magic links | no (handle demo login works) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + `NEXT_PUBLIC_GOOGLE_ENABLED=true` | Google sign-in | no |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis counters | no |
| `COPE_PASS_COST` / `GAG_ORDER_HOURS` | reputation economy tuning | no (50 / 24 defaults) |

4. First deploy: run migrations once with
   `npx prisma migrate deploy` (locally with `DATABASE_URL` pointed at Neon) and seed demo data
   with `npm run db:seed`. After that, schema changes ship via the build command.

## Local development

```bash
npm run db:up        # docker: postgres + redis
npm run setup        # prisma generate + migrate + seed
npm run dev          # http://localhost:3000
```

Sign in with any handle (demo credentials login) — e.g. `TacticalGautam`.

## What's merged from The Pundit Arena

- `src/lib/matchSim.ts` — deterministic seeded matchday simulator (same match → same box score).
- `src/lib/botLineup.ts` — PunditBot 9000 drafts a `validateXI`-clean XI off the same squad.
- `src/app/api/duels/solo/route.ts` — instant scored duel: real box scores on completed matches,
  simulated matchdays on upcoming ones; win pays +25 coins, loss triggers the 24h room gag.
- `src/components/SoloDuelButton.tsx` — "Skip the wait" button on the share page.
- Covered by `src/lib/__tests__/matchSim.test.ts` (29 tests total).

`../the-pundit-arena` remains as the zero-DB static variant if you ever want a no-services deploy.
