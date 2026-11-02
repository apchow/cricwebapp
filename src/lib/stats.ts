import type { Innings } from "@/lib/scoring";

/** Anything that carries innings — a saved match, a live match, a stub. */
export interface InningsSource {
  innings: Innings[];
}

export interface BattingStats {
  name: string;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  outs: number;
  notOuts: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  ducks: number;
}

export interface BowlingStats {
  name: string;
  innings: number;
  balls: number;
  runs: number;
  wickets: number;
  bestWickets: number;
  bestRuns: number;
}

function emptyBatting(name: string): BattingStats {
  return {
    name,
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    outs: 0,
    notOuts: 0,
    highScore: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
  };
}

function emptyBowling(name: string): BowlingStats {
  return {
    name,
    innings: 0,
    balls: 0,
    runs: 0,
    wickets: 0,
    bestWickets: 0,
    bestRuns: 0,
  };
}

/**
 * Aggregate batting figures across every innings the player actually batted in.
 * A batter counts as having batted once they have faced a ball or been
 * dismissed — the same rule the scorecard uses to print "did not bat".
 */
export function battingStats(sources: InningsSource[]): BattingStats[] {
  const table = new Map<string, BattingStats>();

  for (const source of sources) {
    for (const innings of source.innings) {
      for (const batter of innings.batters) {
        const atCrease =
          innings.batters[innings.striker] === batter ||
          (innings.nonStriker >= 0 && innings.batters[innings.nonStriker] === batter);
        if (batter.balls === 0 && batter.out === null && !atCrease) continue;

        const record = table.get(batter.name) ?? emptyBatting(batter.name);
        record.innings += 1;
        record.runs += batter.runs;
        record.balls += batter.balls;
        record.fours += batter.fours;
        record.sixes += batter.sixes;
        record.highScore = Math.max(record.highScore, batter.runs);
        if (batter.out) record.outs += 1;
        else record.notOuts += 1;
        if (batter.runs >= 100) record.hundreds += 1;
        else if (batter.runs >= 50) record.fifties += 1;
        if (batter.runs === 0 && batter.out) record.ducks += 1;
        table.set(batter.name, record);
      }
    }
  }

  return Array.from(table.values()).sort(
    (a, b) => b.runs - a.runs || a.name.localeCompare(b.name)
  );
}

/** Aggregate bowling figures across every innings the player bowled in. */
export function bowlingStats(sources: InningsSource[]): BowlingStats[] {
  const table = new Map<string, BowlingStats>();

  for (const source of sources) {
    for (const innings of source.innings) {
      for (const bowler of innings.bowlers) {
        const stillBowling = innings.bowler === bowler.name && !innings.done;
        if (bowler.balls === 0 && bowler.wickets === 0 && !stillBowling) continue;

        const record = table.get(bowler.name) ?? emptyBowling(bowler.name);
        record.innings += 1;
        record.balls += bowler.balls;
        record.runs += bowler.runs;
        record.wickets += bowler.wickets;
        const better =
          bowler.wickets > record.bestWickets ||
          (bowler.wickets === record.bestWickets && bowler.runs < record.bestRuns);
        if (better) {
          record.bestWickets = bowler.wickets;
          record.bestRuns = bowler.runs;
        }
        table.set(bowler.name, record);
      }
    }
  }

  return Array.from(table.values()).sort(
    (a, b) => b.wickets - a.wickets || a.runs - b.runs || a.name.localeCompare(b.name)
  );
}

/** Runs per dismissal. `null` while a player is unbeaten. */
export function battingAverage(stats: BattingStats): number | null {
  return stats.outs > 0 ? stats.runs / stats.outs : null;
}

/** Runs per 100 balls faced. */
export function strikeRate(stats: BattingStats): number {
  return stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0;
}

/** Runs conceded per over. */
export function economy(stats: BowlingStats): number {
  return stats.balls > 0 ? stats.runs / (stats.balls / 6) : 0;
}

/** Balls per wicket. `null` when the bowler has not struck. */
export function bowlingAverage(stats: BowlingStats): number | null {
  return stats.wickets > 0 ? stats.runs / stats.wickets : null;
}

function dayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days of activity ending today or yesterday, using UTC day keys.
 * Yesterday counts so the streak does not reset before the user has had a
 * chance to open the app today.
 */
export function activityStreak(dates: string[], now: Date = new Date()): number {
  const days = new Set(
    dates.map(dayKey).filter((day): day is string => day !== null)
  );
  if (!days.size) return 0;

  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
