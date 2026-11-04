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
 * One `currentMatches` call carries both live and upcoming fixtures, and every
 * browser poll is served from this process's cache, so the provider is called
 * at most once per interval no matter how many tabs are open.
 */
export const UPSTREAM_MIN_INTERVAL_MS = 4 * 60_000;
export const DEFAULT_DAILY_BUDGET = 450;

const INTERNATIONAL_TYPES = ["Test", "ODI", "T20I", "T20", "Women ODI", "Women T20I"];

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function first(value: unknown): string {
  return str(asArray(value)[0]);
}

/**
 * CricAPI's `current_matches` payload is loose: `status` and `score` are arrays
 * per innings, `teamInfo` may be missing on older series, and `startTimeUtc` can
 * be an empty string. Everything degrades to an empty string rather than
 * throwing, because a bad payload should show an empty board, not a 500.
 */
export function normaliseCricApi(payload: unknown): LiveMatch[] {
  const rows = asArray(
    (payload as { data?: unknown })?.data ?? (payload as { matches?: unknown })?.matches
  );

  return rows
    .map((raw, index): LiveMatch | null => {
      const item = raw as Record<string, unknown>;
      if (!item || typeof item !== "object") return null;

      const id = str(item.id ?? item.matchId);
      if (!id) return null;

      const info = asArray(item.teamInfo).map((entry) => {
        const team = entry as Record<string, unknown>;
        return {
          name: str(team.name) || str(team.teamName),
          short: str(team.shortname) || str(team.shortName),
        };
      });
      const names = asArray(item.teams).map((name) => str(name)).filter(Boolean);
      const scores = asArray(item.score).map((entry) => {
        const innings = entry as Record<string, unknown>;
        const runs = innings.runs;
        const wickets = innings.wickets;
        const overs = innings.overs;
        if (runs === undefined) return "";
        return `${str(innings.team) || names[0] || ""} ${runs}${
          wickets !== undefined ? `/${wickets}` : ""
        }${overs !== undefined ? ` (${overs})` : ""}`.trim();
      });

      const teams: LiveTeam[] = (
        info.length ? info : names.map((name) => ({ name, short: "" }))
      )
        .slice(0, 2)
        .map((team, position) => ({
          ...team,
          score: scores[position] || undefined,
        }));

      const started = item.matchStarted === true;
      const finished = item.matchEnded === true;
      const startRaw = str(item.startTimeUtc ?? item.startDateUtc);
      const startsAt =
        startRaw && !Number.isNaN(Date.parse(startRaw))
          ? new Date(startRaw).toISOString()
          : null;

      const matchType = str(item.type) || str(item.format);

      return {
        id,
        title: str(item.name) || `${teams[0]?.short ?? "?"} vs ${teams[1]?.short ?? "?"}`,
        matchType,
        venue: str(item.venue),
        teams,
        status: first(item.status) || first(item.statusText),
        live: started && !finished,
        started,
        finished,
        startsAt,
        international: INTERNATIONAL_TYPES.includes(matchType),
      };
    })
    .filter((match): match is LiveMatch => match !== null);
}

/** Live right now, and internationals still to start, soonest first. */
export function splitFeed(matches: LiveMatch[], now = Date.now()) {
  const live = matches.filter((match) => match.live);
  const upcoming = matches
    .filter(
      (match) =>
        match.international &&
        !match.started &&
        !match.finished &&
        match.startsAt !== null &&
        Date.parse(match.startsAt) > now
    )
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));

  return { live, upcoming: upcoming.slice(0, 8) };
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
  key: string,
  live: LiveMatch[],
  upcoming: LiveMatch[],
  now: number,
  usedToday: number,
  extra: { error?: string | null; cached?: boolean } = {}
): LiveFeed {
  const budget = dailyBudget();
  return {
    enabled: true,
    error: extra.error ?? null,
    live,
    upcoming,
    fetchedAt: new Date(now).toISOString(),
    cached: extra.cached ?? false,
    nextRefreshAt:
      extra.error || usedToday >= budget
        ? null
        : new Date(now + UPSTREAM_MIN_INTERVAL_MS).toISOString(),
    usedToday,
    budget,
  };
}

/** Server-only: the key never reaches the browser. */
export async function fetchLiveFeed(): Promise<LiveFeed> {
  const key = str(process.env.CRICAPI_KEY);
  const now = Date.now();

  if (!key) {
    return {
      enabled: false,
      error: null,
      live: [],
      upcoming: [],
      fetchedAt: new Date(now).toISOString(),
      cached: false,
      nextRefreshAt: null,
      usedToday: 0,
      budget: dailyBudget(),
    };
  }

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
        nextRefreshAt:
          usedToday >= budget || cache.feed.error
            ? null
            : new Date(cache.fetchedAt + UPSTREAM_MIN_INTERVAL_MS).toISOString(),
      };
    }
    return assemble(key, [], [], now, usedToday, {
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

    if (!response.ok) {
      // Failures are cached too, so a dead key cannot spend the whole quota.
      const feed = assemble(key, [], [], now, usedToday + 1, {
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
      const feed = assemble(key, [], [], now, usedToday + 1, {
        error: `Live provider rejected the key (${str(payload.reason) || status})`,
      });
      cache = { feed, fetchedAt: now };
      return feed;
    }

    const { live, upcoming } = splitFeed(normaliseCricApi(payload), now);
    const feed = assemble(key, live, upcoming, now, usedToday + 1);
    cache = { feed, fetchedAt: now };
    return feed;
  } catch {
    const feed = assemble(key, [], [], now, usedToday + 1, {
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
