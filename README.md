# CricHub

Three cricket tools in one small Next.js app: a squad builder, a batting mini-game,
and a ball-by-ball gully scorer that follows *your* street rules instead of the MCC's.

No database service, no external accounts, no telemetry. `npm install && npm run dev`
and it runs.

## The tools

| Route | What it does |
| --- | --- |
| `/xi-builder` | Pick 11 from 40 international players. Live validation (keeper, bowling and batting balance), share to clipboard, and save named XIs to your account. |
| `/mini-game` | **Street Strike** — a timing-based batting simulation. Read the delivery, time your shot, and the ball goes where your timing sends it. Personal best is kept in your browser. |
| `/scorer` | **Gully Scorer** — full match scoring: teams, optional wicket-keeper, 1–60 overs, venues, custom gully rules, ball-by-ball entry, undo, scorecards, result, and history. **Sign-in required.** |

## Accounts

Accounts exist so that scorer data and saved XIs belong to someone.

- Email + password, hashed with `scrypt` (per-user salt) — plaintext passwords are never stored.
- Sessions are a signed (`HMAC-SHA256`) httpOnly cookie, 30 days.
- Records live in `data/crichub.json`, which is git-ignored. There is no external DB.
- `/scorer` and its APIs redirect/`401` without a session. XI saving requires a session;
  browsing and the mini-game do not.

Set `CRICHUB_SECRET` (any string of 16+ chars) to fix the signing key. Without it the app
generates `data/.session-secret` on first boot, which keeps sessions valid across restarts
on one machine.

### API

```
POST   /api/auth/register   { email, password }
POST   /api/auth/login      { email, password }
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/xis             POST /api/xis { name, players[] }      DELETE /api/xis/{id}
GET    /api/matches                                                            /api/matches/{id}
GET|PUT|DELETE /api/match-state        # the in-progress match, so a refresh resumes it
```

Every payload is validated server-side (`src/lib/validate.ts`): strings length-capped,
numbers range-checked, enums whitelisted, arrays capped. Anything malformed is rejected
with `400` rather than written to disk.

## Scoring rules the app enforces

- Format is derived from overs: 1–7 Mini Match, 8–15 T10, 16–25 T20, 26–39 Half Day, 40–60 One Day.
- Wides and no-balls add a run and do not count as a delivery; the batter faces a no-ball.
- Odd runs and the end of an over rotate strike; a new bowler is required each over.
- An innings ends on the over limit, on all out (`players − 1` wickets, so a two-man
  gully pair ends on one wicket), or on reaching the target.
- Gully rule presets are event → outcome buttons: `One-Tip Catch` (out),
  `Over Boundary = Out`, `Wall Hit` (1 run), `Window Hit` (out + 2 penalty runs).
  Enable any subset per match; each becomes a scoring-pad button.
- Stumping only appears when the fielding side has a keeper set.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

Requires Node 18.17+.

## Layout

```
src/app/            routes: home, xi-builder, mini-game, scorer, login, api/
src/components/     shared UI: navbar account menu, tool header, toast
src/data/           the 40-player pool and the tool catalogue
src/lib/            scoring engine, auth, JSON store, payload validation,
                    API helpers (session guard, JSON body) and DTOs
data/               created at runtime; git-ignored
```

The navbar and the hub cards both render from `src/data/tools.ts`, so a rename
happens in one place. The builder and scorer share the same toast, header and
`PublicXI` / `PublicMatch` payload types, and every protected route goes through
`sessionGate()` in `src/lib/api.ts` instead of repeating a 401 block.

## Deploying

The app assumes one filesystem it can write to. On a persistent host (VPS, Fly, Railway)
it works as-is. On serverless hosts (Vercel/Netlify) the read-only filesystem means
accounts and saved matches will not persist — swap `src/lib/store.ts` for a real database
before doing that.
