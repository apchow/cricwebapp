// Relative, extension-qualified import: this module is also loaded by
// `node --test`, which does not understand the "@/lib" alias.
import { mutate, query } from "./store.ts";

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
 * One `currentMatches` call carries in-play and finished matches. Every browser
 * poll is answered from this process's cache, so the provider is called at most
 * once per interval however many tabs are open.
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

/**
 * Age-group sides wear the senior `matchType` — an U19 ODI is still "odi" — so
 * the international filter alone lets them onto the board. The age marker lives
 * in the title or a team name ("India U19", "Australia Under-19s"), never in the
 * type, so it has to be read from the text.
 */
const AGE_GROUP = /\b(?:u|under)[\s-]?(?:1[5-9]|2[0-3])s?\b|\byouth\b/i;

function isAgeGroup(match: LiveMatch): boolean {
  return (
    AGE_GROUP.test(match.title) ||
    match.teams.some((team) => AGE_GROUP.test(team.name))
  );
}

/** What is in play now, and the most recent international results. */
export function splitFeed(matches: LiveMatch[]) {
  const time = (match: LiveMatch, fallback: number) =>
    match.startsAt ? Date.parse(match.startsAt) : fallback;

  const senior = matches.filter((match) => !isAgeGroup(match));
  const live = senior.filter((match) => match.live);
  const recent = senior
    .filter((match) => match.finished && match.international)
    .sort((a, b) => time(b, 0) - time(a, 0))
    .slice(0, 6);

  return { live, recent };
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

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

interface Memory {
  day: string;
  count: number;
  fetchedAt: number;
  feed: LiveFeed | null;
}

/**
 * This process's own copy of the day. Serverless instances share neither
 * memory nor — without `DATABASE_URL` — a writable disk, so the shared
 * document is an optimisation and this is the floor underneath it.
 */
let memory: Memory = { day: "", count: 0, fetchedAt: 0, feed: null };
let inflight: Promise<LiveFeed> | null = null;

function rollover(now: number): void {
  if (memory.day !== todayKey(now)) {
    memory = { day: todayKey(now), count: 0, fetchedAt: 0, feed: null };
  }
}

interface SharedState {
  usedToday: number;
  lastFetchedAt: number | null;
  feed: LiveFeed | null;
}

/**
 * Storage trouble must not take the scores down with it. On a read-only host
 * the counter cannot be written at all, and a throw from here would discard a
 * perfectly good provider response.
 */
async function readState(now: number): Promise<SharedState> {
  rollover(now);
  const own: SharedState = {
    usedToday: memory.count,
    lastFetchedAt: memory.fetchedAt || null,
    feed: memory.feed,
  };

  try {
    const usage = await query((db) => db.liveUsage);
    if (usage.day !== todayKey(now)) return own;
    return {
      usedToday: Math.max(usage.count, memory.count),
      lastFetchedAt: Math.max(usage.fetchedAt ?? 0, memory.fetchedAt) || null,
      feed: (usage.feed as LiveFeed | undefined) ?? memory.feed,
    };
  } catch {
    return own;
  }
}

/** Records an upstream call in memory first, then in the shared document. */
async function recordFetch(
  now: number,
  feed: LiveFeed,
  usedToday: number
): Promise<void> {
  const count = usedToday + 1;
  memory = { day: todayKey(now), count, fetchedAt: now, feed };
  try {
    await mutate((db) => {
      db.liveUsage = { day: todayKey(now), count, fetchedAt: now, feed };
    });
  } catch {
    /* Nothing writable: this instance keeps the feed, others re-fetch. */
  }
}

function assemble(
  live: LiveMatch[],
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

  // A fresh feed in memory answers without touching storage at all, so a page
  // left open costs nothing between refreshes.
  if (memory.feed && now - memory.fetchedAt < UPSTREAM_MIN_INTERVAL_MS) {
    return { ...memory.feed, cached: true, usedToday: memory.count };
  }

  const state = await readState(now);
  const shared = state.feed;
  const sharedAt = state.lastFetchedAt;

  // Another instance may already have spent a call on these same four minutes;
  // adopt its payload rather than buy a second copy.
  if (shared && sharedAt !== null && now - sharedAt < UPSTREAM_MIN_INTERVAL_MS) {
    memory = {
      day: todayKey(now),
      count: state.usedToday,
      fetchedAt: sharedAt,
      feed: shared,
    };
    return { ...shared, cached: true, usedToday: state.usedToday };
  }

  const decision = shouldFetchUpstream({
    now,
    lastFetchedAt: state.lastFetchedAt,
    usedToday: state.usedToday,
    budget,
  });

  if (!decision.fetch) {
    if (shared) {
      return {
        ...shared,
        cached: true,
        fetchedAt: new Date(sharedAt ?? now).toISOString(),
        usedToday: state.usedToday,
      };
    }
    return assemble([], [], now, state.usedToday, {
      error:
        decision.reason === "budget"
          ? `Daily live-feed budget of ${budget} requests is used up — it resets tomorrow.`
          : null,
    });
  }

  const feed = await callProvider(key, now, state.usedToday);
  await recordFetch(now, feed, state.usedToday);
  return feed;
}

/**
 * Failures come back as feeds rather than throws, and are recorded like
 * successes, so a dead key cannot burn the quota by being retried every poll.
 */
async function callProvider(
  key: string,
  now: number,
  usedToday: number
): Promise<LiveFeed> {
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(
    key
  )}&offset=0`;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return assemble([], [], now, usedToday + 1, {
      error: "Live provider unreachable",
    });
  }

  if (!response.ok) {
    return assemble([], [], now, usedToday + 1, {
      error: `Live provider returned ${response.status}`,
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return assemble([], [], now, usedToday + 1, {
      error: "Live provider sent an unreadable response",
    });
  }

  // CricAPI answers 200 even for a rejected key, so the status field is the
  // only way to tell "bad key" apart from "nothing is playing".
  const status = str(payload.status);
  if (status && status !== "success" && status !== "true") {
    return assemble([], [], now, usedToday + 1, {
      error: `Live provider rejected the key (${str(payload.reason) || status})`,
    });
  }

  const split = splitFeed(normaliseCricApi(payload));
  return assemble(split.live, split.recent, now, usedToday + 1);
}

/** Test seam: forget what this process has fetched. */
export function resetLiveCache(): void {
  memory = { day: "", count: 0, fetchedAt: 0, feed: null };
  inflight = null;
}
