// Relative and extension-qualified: `node --test` loads this module too, and
// it does not understand the "@/lib" alias for value imports.
import { TEST_INNINGS } from "./scoring.ts";
import type {
  BallEvent,
  Batter,
  Bowler,
  Innings,
  MatchState,
  WicketType,
} from "@/lib/scoring";

const WICKETS: WicketType[] = [
  "Bowled",
  "Caught",
  "LBW",
  "Run Out",
  "Stumped",
  "Hit Wicket",
  "Gully Rule",
];

export function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length || trimmed.length > max) return null;
  return trimmed;
}

export function whole(value: unknown, min: number, max: number): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function bool(value: unknown): boolean {
  return value === true;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface CleanTeam {
  name: string;
  players: string[];
  keeper: number | null;
}

export function cleanTeam(value: unknown): CleanTeam | null {
  const input = record(value);
  if (!input) return null;
  const name = text(input.name, 40);
  if (!name || !Array.isArray(input.players)) return null;
  const players = input.players
    .slice(0, 11)
    .map((player) => text(player, 30))
    .filter((player): player is string => Boolean(player));
  if (!players.length) return null;
  const keeper =
    input.keeper === null ? null : whole(input.keeper, 0, players.length - 1);
  return { name, players, keeper };
}

export interface CleanConfig {
  teamA: CleanTeam;
  teamB: CleanTeam;
  overs: number;
  /** Overs for the chase, when the sides agree on a revised limit. */
  oversB?: number;
  /** Two innings per side, and an optional cap per innings. */
  isTest?: boolean;
  testOvers?: number;
  venue: string;
  ruleIds: string[];
}

export const RULE_IDS = ["one-tip", "boundary-out", "wall-hit", "window-hit"];
export const VENUE_NAMES = ["Street / Gully", "Box", "Turf", "Ground"];

export function cleanConfig(value: unknown): CleanConfig | null {
  const input = record(value);
  if (!input) return null;
  const teamA = cleanTeam(input.teamA);
  const teamB = cleanTeam(input.teamB);
  const overs = whole(input.overs, 1, 60);
  const venue = text(input.venue, 20);
  if (!teamA || !teamB || overs === null || !venue) return null;
  const ruleIds = Array.isArray(input.ruleIds)
    ? input.ruleIds.filter((id): id is string => RULE_IDS.includes(String(id)))
    : [];
  const oversB =
    input.oversB === undefined || input.oversB === null
      ? undefined
      : whole(input.oversB, 1, 60) ?? undefined;
  // A resumed Test has to know it is a Test: without these two the innings cap
  // reappears and the format badge quietly changes under the scorer.
  const testOvers =
    input.testOvers === undefined || input.testOvers === null
      ? undefined
      : whole(input.testOvers, 0, 90) ?? undefined;
  return {
    teamA,
    teamB,
    overs,
    ...(oversB ? { oversB } : {}),
    ...(bool(input.isTest) ? { isTest: true } : {}),
    ...(testOvers ? { testOvers } : {}),
    venue,
    ruleIds,
  };
}

function cleanBatter(value: unknown): Batter | null {
  const input = record(value);
  if (!input) return null;
  const name = text(input.name, 30);
  if (!name) return null;
  return {
    name,
    runs: whole(input.runs, 0, 2000) ?? 0,
    balls: whole(input.balls, 0, 500) ?? 0,
    fours: whole(input.fours, 0, 500) ?? 0,
    sixes: whole(input.sixes, 0, 500) ?? 0,
    out: input.out === null ? null : oneOf(input.out, WICKETS),
  };
}

function cleanBowler(value: unknown): Bowler | null {
  const input = record(value);
  if (!input) return null;
  const name = text(input.name, 30);
  if (!name) return null;
  return {
    name,
    balls: whole(input.balls, 0, 500) ?? 0,
    runs: whole(input.runs, 0, 2000) ?? 0,
    wickets: whole(input.wickets, 0, 50) ?? 0,
  };
}

function cleanEvent(value: unknown, id: number): BallEvent | null {
  const input = record(value);
  if (!input) return null;
  const striker = text(input.striker, 30);
  const label = text(input.label, 12);
  const detail = text(input.detail, 120);
  const overText = text(input.overText, 8);
  if (!striker || !label || !detail || !overText) return null;
  return {
    id,
    label,
    detail,
    legal: bool(input.legal),
    runs: whole(input.runs, 0, 50) ?? 0,
    wicket: input.wicket === null ? null : oneOf(input.wicket, WICKETS),
    striker,
    bowler: text(input.bowler, 30),
    overText,
  };
}

function cleanInnings(value: unknown): Innings | null {
  const input = record(value);
  if (!input) return null;
  const battingTeam = text(input.battingTeam, 40);
  const bowlingTeam = text(input.bowlingTeam, 40);
  if (!battingTeam || !bowlingTeam) return null;
  if (!Array.isArray(input.order) || !Array.isArray(input.batters)) return null;
  const order = input.order
    .slice(0, 11)
    .map((name) => text(name, 30))
    .filter((name): name is string => Boolean(name));
  const batters = input.batters
    .slice(0, 11)
    .map(cleanBatter)
    .filter((batter): batter is Batter => Boolean(batter));
  if (!order.length || batters.length !== order.length) return null;
  if (!Array.isArray(input.bowlers)) return null;
  const bowlers = input.bowlers
    .slice(0, 11)
    .map(cleanBowler)
    .filter((bowler): bowler is Bowler => Boolean(bowler));
  if (!Array.isArray(input.events) || !Array.isArray(input.fow)) return null;
  const events = input.events
    .slice(0, 400)
    .map((event, index) => cleanEvent(event, index + 1))
    .filter((event): event is BallEvent => Boolean(event));
  const fow = input.fow
    .slice(0, 11)
    .map((line) => text(line, 80))
    .filter((line): line is string => Boolean(line));

  // 60 overs used to be the ceiling, and a ball past it came back as zero —
  // which is every innings of a Test played to time.
  const legalBalls = whole(input.legalBalls, 0, 1200) ?? 0;
  const wickets = whole(input.wickets, 0, 10) ?? 0;
  const extras = record(input.extras);
  const striker = whole(input.striker, 0, order.length - 1) ?? 0;
  const nonStrikerRaw = input.nonStriker === -1 ? -1 : input.nonStriker;
  const nonStriker =
    nonStrikerRaw === -1
      ? -1
      : whole(nonStrikerRaw, 0, order.length - 1) ?? 1;

  return {
    battingTeam,
    bowlingTeam,
    runs: whole(input.runs, 0, 3000) ?? 0,
    wickets,
    legalBalls,
    extras: {
      wd: whole(extras?.wd, 0, 300) ?? 0,
      nb: whole(extras?.nb, 0, 300) ?? 0,
      b: whole(extras?.b, 0, 300) ?? 0,
      lb: whole(extras?.lb, 0, 300) ?? 0,
      penalty: whole(extras?.penalty, 0, 300) ?? 0,
    },
    batters,
    order,
    nextIndex: whole(input.nextIndex, 0, order.length) ?? order.length,
    striker,
    nonStriker,
    bowler: input.bowler === null ? null : text(input.bowler, 30),
    lastBowler: input.lastBowler === null ? null : text(input.lastBowler, 30),
    bowlers,
    events,
    fow,
    done: bool(input.done),
    ...(bool(input.declared) ? { declared: true } : {}),
  };
}

export function cleanMatch(value: unknown): MatchState | null {
  const input = record(value);
  if (!input || !Array.isArray(input.innings) || !input.innings.length) {
    return null;
  }
  const innings = input.innings
    .slice(0, TEST_INNINGS)
    .map(cleanInnings)
    .filter((item): item is Innings => Boolean(item));
  if (!innings.length) return null;
  const current = whole(input.current, 0, innings.length - 1) ?? 0;
  const target =
    input.target === null ? null : whole(input.target, 1, 3001);
  // The Test flags have to survive the round trip: without `isTest` a resumed
  // match is read back as a two-innings game, so innings three and four would
  // look like a finished match, and a recorded result would vanish.
  return {
    innings,
    current,
    target,
    ...(bool(input.isTest) ? { isTest: true } : {}),
    ...(bool(input.complete) ? { complete: true } : {}),
    ...(text(input.recordedResult, 120)
      ? { recordedResult: text(input.recordedResult, 120) as string }
      : {}),
  };
}

export function cleanXIPlayers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > 11) return null;
  const ids = value
    .map((item) => whole(item, 1, 1000))
    .filter((id): id is number => id !== null);
  return ids.length ? ids : null;
}

/**
 * A list of opaque string ids (series → matches). Returns `null` when the
 * payload is not an array at all, and an empty array for a valid empty list.
 */
export function cleanStringIds(value: unknown, max = 200): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  return value
    .map((item) => text(item, 64))
    .filter((id): id is string => Boolean(id));
}

export interface CleanMatchEntry {
  format: string;
  venue: string;
  scoreline: string;
  result: string;
  innings: Innings[];
}

export function cleanMatchEntry(value: unknown): CleanMatchEntry | null {
  const input = record(value);
  if (!input) return null;
  const format = text(input.format, 20);
  const venue = text(input.venue, 20);
  // Four innings of two 24-character team names overflows what a chase needs.
  const scoreline = text(input.scoreline, 400);
  const result = text(input.result, 120);
  if (!format || !venue || !scoreline || !result) return null;
  if (!Array.isArray(input.innings)) return null;
  const innings = input.innings
    .slice(0, TEST_INNINGS)
    .map(cleanInnings)
    .filter((item): item is Innings => Boolean(item));
  // A Test can be closed after three innings, or drawn inside the second, so
  // this cannot demand the pair a limited match always has.
  if (!innings.length) return null;
  return { format, venue, scoreline, result, innings };
}
