import { promises as fs } from "node:fs";
import path from "node:path";

export interface LiveTeam {
  name: string;
  short: string;
  score?: string;
}

export interface LiveMatch {
  id: string;
  title: string;
  matchType: string;
  venue: string;
  teams: LiveTeam[];
  status: string;
  live: boolean;
  started: boolean;
  finished: boolean;
  startsAt: string | null;
  international: boolean;
}

export interface LiveFeed {
  enabled: boolean;
  error: string | null;
  live: LiveMatch[];
  upcoming: LiveMatch[];
  recent: LiveMatch[];
  fetchedAt: string;
  /** True when served from the shared cache instead of the provider. */
  cached: boolean;
  /** When the next upstream call may happen, or null if the feed is off. */
  nextRefreshAt: string | null;
  /** Upstream calls used today, and the ceiling they are kept under. */
  usedToday: number;
  budget: number;
}

/**
 * One `currentMatches` call carries in-play, scheduled and recently finished
 * matches. Every browser poll is answered from this process's cache, so the
 * provider is called at most once per interval however many tabs are open.
 */
export const UPSTREAM_MIN_INTERVAL_MS = 4 * 60_000;
export const DEFAULT_DAILY_BUDGET = 450;

/** `matchType` is lowercase for domestic leagues, mixed case for international. */
const INTERNATIONAL_TYPES = ["t20i", "odi", "test", "test match", "women odi", "women t20i"];

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** CricAPI sends `status` as a sentence; older payloads use an array. */
function statusText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return str(asArray(value)[0]);
}

function shortName(name: string, given: string): string {
  if (given) return given;
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words[0].slice(0, 3).toUpperCase();
}

/**
 * `score` rows look like `{ r: 97, w: 9, o: "20", inning: "Pokhara Avengers
 * Inning 1" }` and are listed in batting order, which is *not* the order of
 * `teams` — so each innings is matched to its side by name, otherwise a score
 * is printed next to the wrong team.
 */
function inningsByTeam(score: unknown, names: string[]): Map<number, string> {
  const byTeam = new Map<number, string>();
  for (const entry of asArray(score)) {
    const row = entry as Record<string, unknown>;
    if (row.r === undefined) continue;
    const inning = str(row.inning).toLowerCase();
    let position = names.findIndex(
      (name) => name !== "" && inning.includes(name.toLowerCase())
    );
    if (position === -1) position = byTeam.size;
    if (position >= names.length) continue;

    const overs = str(row.o);
    const wickets = typeof row.w === "number" ? `/${row.w}` : "";
    const line = `${row.r}${wickets}${overs ? ` (${overs})` : ""}`;
    byTeam.set(
      position,
      byTeam.has(position) ? `${byTeam.get(position)} · ${line}` : line
    );
  }
  return byTeam;
}

/**
 * The payload is loose: `teamInfo[].shortname` can be null, `startTimeUtc` is
 * often absent, and `status` changes shape between endpoints. Everything
 * degrades to an empty string rather than throwing, because a bad payload
 * should show an empty board, not a 500.
 */
export function normaliseCricApi(payload: unknown): LiveMatch[] {
  const rows = asArray(
    (payload as { data?: unknown })?.data ??
      (payload as { matches?: unknown })?.matches
  );

  return rows
    .map((raw): LiveMatch | null => {
      const item = raw as Record<string, unknown>;
      if (!item || typeof item !== "object") return null;

      const id = str(item.id ?? item.matchId);
      if (!id) return null;

      const info = asArray(item.teamInfo) as Record<string, unknown>[];
      const fromInfo = info
        .map((team) => str(team.name) || str(team.teamName))
        .filter(Boolean);
      const names = fromInfo.length
        ? fromInfo
        : asArray(item.teams)
            .map((name) => str(name))
            .filter(Boolean);

      const scores = inningsByTeam(item.score, names);
      const teams: LiveTeam[] = names.slice(0, 2).map((name, position) => ({
        name,
        short: shortName(name, str(info[position]?.shortname)),
        score: scores.get(position),
      }));

      const started = item.matchStarted === true;
      const finished = item.matchEnded === true;
      const startRaw = str(
        item.startTimeUtc ?? item.dateTimeGMT ?? item.startDateUtc
      );
      const startsAt =
        startRaw && !Number.isNaN(Date.parse(startRaw))
          ? new Date(startRaw).toISOString()
          : null;

      const matchType = str(item.matchType) || str(item.type);

      return {
        id,
        title:
          str(item.name) || `${teams[0]?.short ?? "?"} vs ${teams[1]?.short ?? "?"}`,
        matchType,
        venue: str(item.venue),
        teams,
        status: statusText(item.status) || statusText(item.statusText),
        live: started && !finished,
        started,
        finished,
        startsAt,
        international: INTERNATIONAL_TYPES.includes(matchType.toLowerCase()),
      };
    })
    .filter((match): match is LiveMatch => match !== null);
}

/** In play now, scheduled next, and the most recent results. */
export function splitFeed(matches: LiveMatch[]) {
  const time = (match: LiveMatch, fallback: number) =>
    match.startsAt ? Date.parse(match.startsAt) : fallback;

  const live = matches.filter((match) => match.live);
  const upcoming = matches
    .filter((match) => !match.started && !match.finished)
    .sort(
      (a, b) =>
        time(a, Number.MAX_SAFE_INTEGER) - time(b, Number.MAX_SAFE_INTEGER)
    )
    .slice(0, 8);
  const recent = matches
    .filter((match) => match.finished)
    .sort((a, b) => time(b, 0) - time(a, 0))
    .slice(0, 6);

  return { live, upcoming, recent };
}

export function dailyBudget(): number {
  const raw = Number(process.env.CRICAPI_DAILY_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_BUDGET;
}

export type UpstreamDecision =
  | { fetch: true }
  | { fetch: false; reason: "fresh" | "budget" };

export function shouldFetchUpstream(input: {
  now: number;
  lastFetchedAt: number | null;
  usedToday: number;
  budget: number;
  minIntervalMs?: number;
}): UpstreamDecision {
  const interval = input.minIntervalMs ?? UPSTREAM_MIN_INTERVAL_MS;
  if (input.lastFetchedAt !== null && input.now - input.lastFetchedAt < interval) {
    return { fetch: false, reason: "fresh" };
  }
  if (input.usedToday >= input.budget) return { fetch: false, reason: "budget" };
  return { fetch: true };
}

function usageFile() {
  return path.join(process.cwd(), "data", "live-usage.json");
}

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

async function readUsage(now: number): Promise<number> {
  try {
    const parsed = JSON.parse(await fs.readFile(usageFile(), "utf8")) as {
      day?: unknown;
      count?: unknown;
    };
    if (str(parsed.day) !== todayKey(now)) return 0;
    const count = typeof parsed.count === "number" ? Math.floor(parsed.count) : 0;
    return count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

async function writeUsage(now: number, count: number): Promise<void> {
  try {
    await fs.mkdir(path.dirname(usageFile()), { recursive: true });
    await fs.writeFile(
      usageFile(),
      JSON.stringify({ day: todayKey(now), count }),
      "utf8"
    );
  } catch {
    // Quota bookkeeping must never break the feed itself.
  }
}

let cache: { feed: LiveFeed; fetchedAt: number } | null = null;
let inflight: Promise<LiveFeed> | null = null;

function assemble(
  live: LiveMatch[],
  upcoming: LiveMatch[],
  recent: LiveMatch[],
  now: number,
  usedToday: number,
  extra: { error?: string | null; cached?: boolean } = {}
): LiveFeed {
  const budget = dailyBudget();
  const error = extra.error ?? null;
  return {
    enabled: true,
    error,
    live,
    upcoming,
    recent,
    fetchedAt: new Date(now).toISOString(),
    cached: extra.cached ?? false,
    nextRefreshAt:
      error || usedToday >= budget
        ? null
        : new Date(now + UPSTREAM_MIN_INTERVAL_MS).toISOString(),
    usedToday,
    budget,
  };
}

function disabledFeed(now: number): LiveFeed {
  return {
    enabled: false,
    error: null,
    live: [],
    upcoming: [],
    recent: [],
    fetchedAt: new Date(now).toISOString(),
    cached: false,
    nextRefreshAt: null,
    usedToday: 0,
    budget: dailyBudget(),
  };
}

/** Server-only: the key never reaches the browser. */
export async function fetchLiveFeed(): Promise<LiveFeed> {
  const key = str(process.env.CRICAPI_KEY);
  const now = Date.now();
  if (!key) return disabledFeed(now);

  // Collapse concurrent polls into a single upstream call.
  if (inflight) return inflight;
  inflight = build(key, now).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function build(key: string, now: number): Promise<LiveFeed> {
  const budget = dailyBudget();
  const usedToday = await readUsage(now);
  const decision = shouldFetchUpstream({
    now,
    lastFetchedAt: cache?.fetchedAt ?? null,
    usedToday,
    budget,
  });

  if (!decision.fetch) {
    if (cache) {
      return {
        ...cache.feed,
        cached: true,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        usedToday,
      };
    }
    return assemble([], [], [], now, usedToday, {
      error:
        decision.reason === "budget"
          ? `Daily live-feed budget of ${budget} requests is used up — it resets tomorrow.`
          : null,
    });
  }

  try {
    const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(
      key
    )}&offset=0`;
    const response = await fetch(url, { cache: "no-store" });
    await writeUsage(now, usedToday + 1);

    // Failures are cached like successes, so a dead key cannot burn the quota.
    if (!response.ok) {
      const feed = assemble([], [], [], now, usedToday + 1, {
        error: `Live provider returned ${response.status}`,
      });
      cache = { feed, fetchedAt: now };
      return feed;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    // CricAPI answers 200 even for a rejected key, so the status field is the
    // only way to tell "bad key" apart from "nothing is playing".
    const status = str(payload.status);
    if (status && status !== "success" && status !== "true") {
      const feed = assemble([], [], [], now, usedToday + 1, {
        error: `Live provider rejected the key (${str(payload.reason) || status})`,
      });
      cache = { feed, fetchedAt: now };
      return feed;
    }

    const split = splitFeed(normaliseCricApi(payload));
    const feed = assemble(
      split.live,
      split.upcoming,
      split.recent,
      now,
      usedToday + 1
    );
    cache = { feed, fetchedAt: now };
    return feed;
  } catch {
    const feed = assemble([], [], [], now, usedToday + 1, {
      error: "Live provider unreachable",
    });
    cache = { feed, fetchedAt: now };
    return feed;
  }
}

/** Test seam: forget the shared cache. */
export function resetLiveCache(): void {
  cache = null;
  inflight = null;
}
