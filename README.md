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
| `/xi-builder` | Name your eleven on a top-down pitch — drag to a slot, tap **Add**, or tap a player then a slot. Series mode is locked to the actual India tour of New Zealand squads; franchise mode keeps the four-overseas cap and purse-aware auto-pick. Signed-in XIs can be saved to your account. |
| `/scorer` | Ball-by-ball scoring with custom gully rules, undo, scorecard, a **Test** format, a **turf 1 v 1** preset with a chosen wicket count, and hour-long camera recording. Auto-saved to your account. **Sign-in required.** |
| `/mini-game` | Street Strike — a top-down batting simulation with real delivery timings and timing-error outcomes. Personal best stays in your browser. |
| `/players` | Search the whole player database; your own scored-match figures sit on top. Franchise filters are abbreviation chips in team colours, and Pakistan players carry **no price** — they have never been in the IPL, so `iplPriceOf` returns null and the UI says "Not in IPL". |
| `/series` | Points table and net run rate across your completed matches. |
| `/history` | Match centre: every scored match with analytics. |
| `/dashboard` | Streaks, aggregates and your saved XIs. |
| `/banter` | A shared comment wall, hosted on the server. Reading is public; posting needs an account. Only the **latest 10 takes** are kept — older ones roll off. Links are rejected server-side, so the wall cannot be used to advertise. |

## Scoring a match

Ball entry works by keyboard as well as by tap, which is the point when one
hand is holding a phone on a brick: `0`–`6` runs, `w` wide, `n` no-ball, `x` how
he is out, `u` undo, `y` redo. Nothing typed into a name field, and nothing
while a modal is open, is read as a shortcut.

**Test** is a format choice, not an over count. Each side bats twice, an innings
ends on all out, a declaration, or a cap you can set (0 means uncapped), and the
match can be closed as a draw with time called. Two things about the arithmetic
are worth knowing:

- The fourth innings chases **the lead**, not a total. `chaseTargetFor` in
  `src/app/scorer/scorer-client.tsx` computes it from `teamRuns`, so an innings-2
  target in a limited match and a four-innings lead use the same code path.
- A Test can be decided without the last side batting again — 100 and 100
  against 400/6 is *won by 4 wickets*, and no arithmetic over the innings still
  to come expresses that. The scorer records it explicitly
  (`recordedResult`), and the engine returns that string verbatim.

Follow-on needs no code: sides alternate A, B, A, B whichever way they got there.

**Turf 1 v 1** is one tap in Match settings: one player a side bats and bowls,
two innings each, uncapped overs, and a wicket count you choose (1–50, chips for
the common counts). The lone batter **returns after every dismissal** until the
count runs out, so the innings ends on your number, not on the roster size; the
scorecard marks them `returned · N× out` and the batting average divides by every
dismissal. Turning the preset off brings the full squads back untouched. The
same wicket count works with a full squad too — it simply ends the innings early.

### Camera recording

The camera bar sits **above every scorer view**, sticky under the site nav, so
`Record` is reachable before the match starts and stays on screen while you
score; a recording survives setup → live → break → result without restarting.
It captures the camera (microphone optional) with a live preview you can hide,
and keeps going for hours. On Chrome and Edge the chunks stream into a file you
choose once, so memory stays flat across a full day; Firefox and Safari have no
file-write API, so the film is rotated into 10-minute segments that download as
they complete — **allow multiple downloads** or everything after segment one is
blocked. Either way chunks flush every 5 seconds, so a crash loses at most that.
Closing the tab while recording is intercepted with a confirmation, and nothing
is uploaded: the film never leaves the device.

`src/lib/record.ts` is the browser-free half (mime selection, byte and clock
formatting, segment timing, the two chunk sinks), and
`src/components/scorer-recorder.tsx` owns the `MediaRecorder` lifecycle.

## The live series

`src/data/fixtures.ts` holds **India's tour of New Zealand, 2026-27**: five ODIs,
all in New Zealand — 4 Nov Eden Park (Auckland), 7 Nov Wellington Regional
Stadium, 10 Nov Seddon Park (Hamilton), 13 and 15 Nov Bay Oval (Tauranga). Both
boards named **split squads**, so ODIs 1-3 and ODIs 4-5 draw from different
player lists and the builder's pool changes when you change the match.

Each window is the squad as announced (BCCI 16 Oct, NZC/ICC 10-11 Oct) **with
every in-series change already applied**: Prasidh Krishna withdrew on 30 Oct and
Auqib Nabi was added to all five on 31 Oct; for New Zealand, Mark Chapman and
Rachin Ravindra withdrew on 1 Nov (Tim Seifert, Dean Foxcroft and Henry Nicholls
in), Devon Conway on 6 Nov (Nick Kelly in), and Lockie Ferguson and Blair
Tickner on 9 Nov (Kristian Clarke in, Matt Henry cleared for the fourth ODI).
Shreyas Iyer captains the India group for ODIs 4-5, with Ishan Kishan vice-captain.

The XI builder only offers players named in that match's squad — you cannot pick
someone who was not selected. The fixture bar states how many of each squad are
on file, so a gap is visible instead of silent.

Sources: [ESPNcricinfo schedule](https://www.cricinfo.com/series/india-in-new-zealand-2026-27-1539421/match-schedule-fixtures-and-results),
[Wikipedia tour page](https://en.wikipedia.org/wiki/Indian_cricket_team_in_New_Zealand_in_2026%E2%80%9327),
[BCCI squad announcement](https://www.bcci.tv/news/article/indias-odi-and-test-squads-for-new-zealand-tour-announced),
[NZC split squads](https://www.icc-cricket.com/news/new-zealand-confirm-split-odi-squads-for-india-series).
Squads move with injuries — edit `fixtures.ts`; nothing else has to change.

## Player data and its honest limits

`public/data/players.json` is the single pool behind retention, the XI builder
and the stats hub. Every Full Member has at least 15 active players.

**Franchise labels and match figures are derived, not editorial.** Regenerate
them with `node scripts/sync-ipl-squads.mjs <dir of Cricsheet IPL json files>`
after downloading https://cricsheet.org/downloads/ipl_json.zip. The script joins
on the registry id that `ipl-squads.json` already stores — never on spelling,
because Cricsheet writes "RD Chahar" for Rahul Chahar and "DL Chahar" for his
cousin Deepak, and a fuzzy initials match once put Pakistan's Shadab Khan into
Chennai's pool. It refreshes career and last-season figures separately, applies
only the trades iplt20.com has confirmed (Pant to DC, Kuldeep to LSG, Natarajan
and Khaleel to SRH, Livingstone, Edwards, Ansari, Ellis), expands scorebook
initials to the name a franchise's own squad page prints, drops the retired, and
adds squad members the database was missing. Retention and release lists for
2027 are due 17 Nov 2026 and were not announced, so nothing beyond that is
assumed. `test/squad-data.test.ts` guards what a regeneration can break: no
duplicated player, no zeroed wicket column, no Pakistan player on a franchise
list, and the two files agreeing on every shared name.

**The ratings are estimates.** `form`, `ppImpact`, `deathImpact` and `vfm` are
banded from each player's real batting and bowling output by the documented
formula in `estimate()` — closer to measured than the guesses they replaced,
still not published ratings, and the dataset says so in its own `sourcing`
field. `scripts/add-internationals.mjs` remains how non-IPL internationals get
added: idempotent, `FREE AGENT` rather than a guessed contract, `punditTag`
derived from form and value. Do not let these numbers pass for statistics in
anything you sell.

## Live scores on the home page

One `currentMatches` call per refresh carries in-play and finished internationals.

- `CRICAPI_KEY` (free tier at [cricapi.com](https://cricapi.com)) enables it; without a key the panel says so plainly.
- Upstream calls are throttled to **one per 4 minutes** and served from a shared cache, so any number of open tabs costs the same quota.
- The feed and its daily counter live in the shared document, so a day's quota is one budget across every instance rather than one per lambda. On Vercel that matters: instances share no memory, so an unshared cache would buy a fresh copy of the same four minutes on every cold start.
- **Storage is optional for the feed.** A host with no `DATABASE_URL` cannot write the counter at all, and an exception there used to discard the scores it arrived with. Reads and writes of the counter now fall back to this process's memory, so live scores show even when accounts cannot persist.
- Provider failures are cached like successes, so a bad key cannot burn the quota.
- CricAPI answers HTTP 200 with `status: "unauthorized"` for a rejected key; that is checked explicitly so a dead key is not mistaken for an empty schedule.
- The key is read server-side only — the browser receives a normalised summary.

## Accounts

Email + password, `scrypt`-hashed with a per-user salt — plaintext passwords are
never stored. Sessions are an HMAC-SHA256-signed httpOnly cookie
(`crichub_session`, 30 days, SameSite=Lax). `/scorer`, the data APIs and posting
to the wall require a session and answer 401 without one; the XI builder's
saved-XIs panel is the same. Login and registration are rate-limited per IP.
Records live in
`data/crichub.json`, which is git-ignored.

The browser asks the server who you are on every page (`/api/auth/me`) — the
sign-in state is not a localStorage guess, so a valid cookie survives a reload,
a new tab and another device. The sign-in dialog offers real account sign-in
plus a clearly-labelled demo option; there are no Google/GitHub buttons, because
this app has no OAuth and pretending otherwise was a lie in the interface.

Set `CRICHUB_SECRET` (16+ characters) to fix the signing key. Without it the app
writes `data/.session-secret` on first boot, which keeps sessions valid across
restarts on one machine. On a read-only filesystem — any serverless host — that
write fails, so the app falls back to a per-instance key: sign-in still works,
but a cold start signs everyone out. `/api/health` reports which case you are in
as `secret: "env" | "file" | "written" | "ephemeral"`, and warns on the last one.

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
GET    /api/banter                    POST /api/banter { text }
POST   /api/banter/react { id }       DELETE /api/banter/{id}
```

### Limits that exist for public traffic

Security headers (`nosniff`, `DENY`, `strict-origin-when-cross-origin`,
Permissions-Policy and a CSP) are set in `next.config.mjs`; `robots.txt` and
`sitemap.xml` are generated. Fixed-window rate limits, per client IP, in-process:

| Endpoint | Limit |
| --- | --- |
| `/api/auth/login` | 10 per 5 min |
| `/api/auth/register` | 5 per 30 min |
| `/api/auth/demo` | 10 per hour |
| `/api/banter` POST | 8 per 5 min |

A restart clears these counters — they slow abuse down, they do not stop a
determined attacker. Note that `/api/auth/demo` hands out **one shared account**:
whatever a demo visitor saves is visible to the next visitor who taps demo.

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

Requires Node 20.9+ — that is Next 16's floor, and `engines` in `package.json`
is also what Vercel reads to choose the runtime.

| Variable | Purpose |
| --- | --- |
| `CRICHUB_SECRET` | Session signing key. Set it in production. |
| `DATABASE_URL` | Postgres connection string. Unset = local `data/` files; set = the whole document lives in Postgres. |
| `CRICAPI_KEY` | Live scores. Optional. |
| `CRICAPI_DAILY_BUDGET` | Defaults to 450. CricAPI's free tier only answers 100 calls a day, so set this to about 90 — the feed then stops politely instead of spending the rest of the day on provider rejections. |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for robots.txt and sitemap.xml. |

Each is "optional" only because the build succeeds without it. Every one that is
missing quietly costs a feature in production: no `DATABASE_URL` means nothing
saves, no `CRICHUB_SECRET` means visitors are signed out on each cold start, and
no `CRICAPI_KEY` means the live board stays switched off. `.env` is git-ignored,
so nothing you set locally reaches Vercel by itself — the values have to be typed
into Project Settings → Environment Variables.

### Two storage drivers, one code path

`src/lib/store.ts` reads and writes the whole application document — users,
saved XIs, matches, series, in-progress matches, the wall, the live-feed quota —
as one JSON value.

- **No `DATABASE_URL`** → `data/crichub.json`, serialised through an in-process
  chain. Good for local development and a VPS with a mounted volume.
- **`DATABASE_URL` set** → a single `app_state` row in Postgres, read and
  written inside a transaction holding `FOR UPDATE` on that row, so any number
  of serverless instances share it without losing writes. Rate-limit counters move
  to `rate_window` at the same time, so a limit is no longer per cold-start.
  Do not swap that for `pg_advisory_xact_lock`: Neon and Vercel Postgres hand
  over a *pooled* URL by default, pooled transactions land on different
  backends, and a session-scoped advisory lock excludes nothing there —
  interleaved writes then delete each other's accounts without any error.

### Deploying to Vercel

1. Push this repo, import it in Vercel. Framework, build and output are detected
   from Next; no `vercel.json` is needed.
   *If pushes stop deploying*, check Project Settings → Git → **Require verified
   commits**. With it on, Vercel refuses any commit GitHub cannot tie to a
   signing key — the deployment is created and immediately `Blocked` with
   *"commit signature couldn't be verified"*, which looks exactly like the Git
   integration being broken. Commits made by a script or a CI bot without a
   signing key are caught by this.
2. Storage → **Create Postgres** (Vercel Postgres, or add a Neon/Supabase
   string). `DATABASE_URL` is injected automatically.
3. Apply the schema once, from your machine with the same URL:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
   No `psql`? `vercel link && vercel env pull` then
   `node scripts/apply-schema.mjs` — it uses the app's own driver and is safe to
   re-run.
4. Project Settings → Environment Variables: `CRICHUB_SECRET` (a real random
   value), `NEXT_PUBLIC_APP_URL`, and `CRICAPI_KEY` if you want live scores.
5. Deploy, then check `GET /api/health`. A healthy deploy answers
   `{"ok":true,"driver":"postgres","secret":"env"}`. Anything else is a
   deployment defect, and the body says which:
   - `ok:false` with *"File storage cannot persist on a serverless host"* —
     `DATABASE_URL` is missing, so accounts and matches would be lost.
   - a `warnings` entry about the session secret — `CRICHUB_SECRET` is unset or
     under 16 characters, so every cold start signs users out.
   - `liveFeed:false` — `CRICAPI_KEY` never arrived, so the live board answers
     "Live scores are switched off". This is the usual cause when a deploy that
     works locally shows no scores.

   The probe **writes**, it does not just read: on a read-only filesystem reads
   succeed while saves fail, so a read-only check would call a broken deploy
   healthy.
6. With `DATABASE_URL` set, run `node scripts/verify-postgres.mjs`. It proves a
   write survives the next read and that parallel writes are not lost — neither
   of which the file driver can demonstrate, which is how two separate
   persistence bugs reached a hosted deploy quietly.

Without a database, a Vercel deploy will *appear* to work and then lose every
account, saved XI and scored match, because the filesystem is read-only and
ephemeral. `/api/health` catches that: it answers `503` with
`driver: "file"` and the `DATABASE_URL` message, rather than reporting a
healthy-looking read.

Before traffic: set `CRICHUB_SECRET` to something other than the locally
generated value, keep `data/` out of version control (already ignored), and
treat a leaked `CRICAPI_KEY` as a quota emergency rather than a security one —
it grants no access to user data.

### After the first deploy, pushing is the whole release

```bash
git push origin main          # Vercel builds it and re-aliases the production URL
node scripts/check-deploy.mjs # optional: asks GitHub, needs no Vercel login
```

Nothing else is required, and re-running the CLI is not part of the loop. The
Git integration posts its result onto the commit as a GitHub status, which is
what `check-deploy.mjs` reads. Three things are deliberately not in this state,
so do not "tidy" them back:

- **Require verified commits is off** (Project Settings → Git). Your commits are
  unsigned, so turning it on silently refuses every push — the deployment is
  created, then `Blocked`, which looks identical to the integration being dead.
- **`DATABASE_URL`, `CRICHUB_SECRET`, `CRICAPI_KEY` and
  `CRICAPI_DAILY_BUDGET` live in the Vercel project**, not in this repo. `.env`
  is ignored, so nothing you set locally ever reaches the deploy.
- **`npm run dev` uses file storage on purpose.** `.env` carries no
  `DATABASE_URL`. Never park the production connection string in `.env.local` —
  Next auto-loads that file and your local dev server would then read and write
  live user data. It belongs in `.vercel/env.local` (ignored, not auto-loaded),
  which is where `apply-schema.mjs` and `verify-postgres.mjs` look for it.

Genuinely needing the dashboard later: changing or rotating an environment
variable, adding a custom domain, and reading a build log if a push goes red.

## Known gaps before you call it finished

- **Moderation is thin.** The wall blocks a short list of flagged words, rejects
  anything link-shaped, caps posting per IP, and lets an author delete their own
  take — but there is no report button, no admin takedown and no per-user
  history. For a public comment wall that is the weakest part of this app.
- **Retention and stats-hub data are IPL-shaped.** Squad lists and franchise
  fields come from `ipl-squads.json`; international series selection reads the
  same player rows by name, so a squad member missing from the database shows
  as a gap in the builder rather than being invented.

## Checks

```bash
npx tsc --noEmit
npm test          # 83 tests: scoring engine, stats, series, insights, auto-pick, live feed, wall
npm run build
```

## Layout

```
src/app/            routes, API handlers, robots and sitemap
src/components/     shared client UI (nav, live board, scorecard, retention planner)
src/data/           fixtures, IPL squads, tool catalogue
src/lib/            scoring, auth, store (file + Postgres), validation, live feed, stats, series
src/store/          zustand client state
db/                 schema.sql — applied once when you move to Postgres
scripts/            add-internationals.mjs
public/data/        players.json — the player database
data/               runtime: accounts, saved matches (git-ignored)
```
