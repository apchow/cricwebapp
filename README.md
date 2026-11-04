# Pundit Arena

Nine cricket tools in one Next.js app: an auction retention room, an XI builder
laid out around a real international series, a ball-by-ball scorer, a batting
mini-game, a stats hub, series tables, a match centre, a dashboard and a banter
wall. No database service, no third-party auth, no telemetry —
`npm install && npm run dev` and it runs.

## Routes

| Route | What it is |
| --- | --- |
| `/retention` | Protect six players from the IPL auction pool under capped/uncapped and purse rules. |
| `/xi-builder` | Name your eleven on a top-down pitch. Series mode is locked to the actual India tour of New Zealand squads; franchise mode keeps the four-overseas cap and purse-aware auto-pick. |
| `/scorer` | Ball-by-ball scoring, 1–60 overs, custom gully rules, undo, scorecard, auto-saved to your account. **Sign-in required.** |
| `/mini-game` | Street Strike — a top-down batting simulation with real delivery timings and timing-error outcomes. Personal best stays in your browser. |
| `/players` | Search the whole player database; your own scored-match figures sit on top. |
| `/series` | Points table and net run rate across your completed matches. |
| `/history` | Match centre: every scored match with analytics. |
| `/dashboard` | Streaks, aggregates and your saved XIs. |
| `/banter` | A comment wall. **Per-browser today:** posts live in `localStorage`, and signing in unlocks posting and reactions. There is no shared server wall yet — see *Known gaps*. |

## The live series

`src/data/fixtures.ts` holds **India's tour of New Zealand, 2026-27**: five ODIs,
all in New Zealand — 4 Nov Eden Park (Auckland), 7 Nov Wellington Regional
Stadium, 10 Nov Seddon Park (Hamilton), 13 and 15 Nov Bay Oval (Tauranga). Both
boards named **split squads**, so ODIs 1-3 and ODIs 4-5 draw from different
player lists and the builder's pool changes when you change the match.

The XI builder only offers players named in that match's squad — you cannot pick
someone who was not selected. The fixture bar states how many of each squad are
on file, so a gap is visible instead of silent.

Sources: [ESPNcricinfo schedule](https://www.cricinfo.com/series/india-in-new-zealand-2026-27-1539421/match-schedule-fixtures-and-results),
[Wikipedia tour page](https://en.wikipedia.org/wiki/Indian_cricket_team_in_New_Zealand_in_2026%E2%80%9327),
[BCCI squad update](https://www.bcci.tv/news/article/india-and-india-a-squad-updates-for-new-zealand-tour).
Squads move with injuries — edit `fixtures.ts`; nothing else has to change.

## Player data and its honest limits

`public/data/players.json` is the single pool behind retention, the XI builder
and the stats hub. Every Full Member has at least 15 active players.

**The ratings are editorial, not measured.** `form`, `ppImpact`, `deathImpact`
and `vfm` are judgement estimates for fantasy selection. This app has no
statistics ingest, and the dataset says so in its own `sourcing` field.
`scripts/add-internationals.mjs` is how players get added: it is idempotent
(existing names are skipped), assigns `FREE AGENT` rather than guessing IPL
contracts, and derives `punditTag` from form and value. If you want real numbers
behind those columns, wire a Cricsheet ingest and regenerate — do not let
editorial estimates pass for statistics in anything you sell.

## Live scores on the home page

One `currentMatches` call per refresh carries in-play and finished internationals.

- `CRICAPI_KEY` (free tier at [cricapi.com](https://cricapi.com)) enables it; without a key the panel says so plainly.
- Upstream calls are throttled to **one per 4 minutes per process** and served from a shared cache, so any number of open tabs costs the same quota.
- A persisted counter in `data/live-usage.json` caps the day at **450** (`CRICAPI_DAILY_BUDGET` to change).
- Provider failures are cached like successes, so a bad key cannot burn the quota.
- CricAPI answers HTTP 200 with `status: "unauthorized"` for a rejected key; that is checked explicitly so a dead key is not mistaken for an empty schedule.
- The key is read server-side only — the browser receives a normalised summary.

## Accounts

Email + password, `scrypt`-hashed with a per-user salt — plaintext passwords are
never stored. Sessions are an HMAC-SHA256-signed httpOnly cookie
(`crichub_session`, 30 days, SameSite=Lax). `/scorer` and the data APIs require a
session and answer 401 without one; the XI builder's saved-XIs panel is the same.
Login and registration are rate-limited per IP. Records live in
`data/crichub.json`, which is git-ignored.

Set `CRICHUB_SECRET` (16+ characters) to fix the signing key. Without it the app
writes `data/.session-secret` on first boot, which keeps sessions valid across
restarts on one machine.

### API

```
POST   /api/auth/register   { email, password }
POST   /api/auth/login      { email, password }
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/xis             POST /api/xis { name, players[] }      DELETE /api/xis/{id}
GET    /api/matches         POST /api/matches                      DELETE /api/matches/{id}
GET|PUT|DELETE /api/match-state        # the in-progress match, so a refresh resumes it
GET    /api/live                      # normalised live + recent internationals
```

Every payload is validated server-side (`src/lib/validate.ts`): strings
length-capped, numbers range-checked, enums whitelisted, arrays capped. Anything
malformed is rejected with `400` rather than written to disk. The navbar and hub
cards both render from `src/data/tools.ts`, and every protected route goes
through `sessionGate()` in `src/lib/api.ts` instead of repeating a 401 block.

## Scoring rules the app enforces

- Format derives from overs: 1–7 Mini Match, 8–15 T10, 16–25 T20, 26–39 Half Day, 40–60 One Day.
- Wides and no-balls add a run and are not deliveries; the batter faces a no-ball.
- Odd runs and the end of an over rotate strike; a new bowler is required each over.
- An innings ends on the over limit, on all out (`players − 1` wickets, so a two-man gully pair ends on one wicket), or on reaching the target.
- Gully presets are event → outcome buttons: `One-Tip Catch` (out), `Over Boundary = Out`, `Wall Hit` (1 run), `Window Hit` (out + 2 penalty runs). Enable any subset per match; each becomes a scoring-pad button.
- Stumping only appears when the fielding side has a keeper set.

## Going live

```bash
npm ci
npm run build
npm start                 # or: PORT=4000 npm start
```

Requires Node 18.17+.

| Variable | Purpose |
| --- | --- |
| `CRICHUB_SECRET` | Session signing key. Set it in production. |
| `CRICAPI_KEY` | Live scores. Optional. |
| `CRICAPI_DAILY_BUDGET` | Defaults to 450. |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for robots.txt and sitemap.xml. |

**Hosting requirement: a writable disk.** Accounts, saved XIs, matches and quota
counters are files under `data/`. On a persistent host (VPS, Railway, Fly, a
container with a mounted volume) it works as-is. On a read-only serverless
filesystem, reads still work but nothing persists — replace `src/lib/store.ts`
with a real database before that deploy. It is the one change standing between
this app and Vercel/Netlify.

Before traffic: set `CRICHUB_SECRET` to something other than the locally
generated value, keep `data/` out of version control (already ignored), and
treat a leaked `CRICAPI_KEY` as a quota emergency rather than a security one —
it grants no access to user data.

## Known gaps before you call it finished

- **Banter is not shared.** Each visitor sees only their own posts because the
  wall reads `localStorage`. Making it a real arena conversation needs a
  `/api/banter` collection in the store plus moderation (rate limits, reporting,
  a delete path) — shipping an unmoderated public comment wall is a liability,
  not a feature.
- **Retention and stats-hub data are IPL-shaped.** Squad lists and franchise
  fields come from `ipl-squads.json`; international series selection reads the
  same player rows by name, so a squad member missing from the database shows
  as a gap in the builder rather than being invented.

## Checks

```bash
npx tsc --noEmit
npm test          # 74 tests: scoring engine, stats, series, insights, auto-pick, live feed
npm run build
```

## Layout

```
src/app/            routes, API handlers, robots and sitemap
src/components/     shared client UI (nav, live board, scorecard, retention planner)
src/data/           fixtures, IPL squads, tool catalogue
src/lib/            scoring, auth, JSON store, validation, live feed, stats, series
src/store/          zustand client state
scripts/            add-internationals.mjs
public/data/        players.json — the player database
data/               runtime: accounts, saved matches, quota (git-ignored)
```
