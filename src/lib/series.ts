import type { Innings } from "@/lib/scoring";

/** The minimum shape a stored match needs to contribute to a series table. */
export interface SeriesMatch {
  id: string;
  createdAt: string;
  innings: Innings[];
}

export interface Outcome {
  /** Winning team, or `null` for a tie. */
  winner: string | null;
  tied: boolean;
  /** True once both innings have finished — only then does it count. */
  complete: boolean;
}

/**
 * Decide a completed two-innings match. The scorer always stores the side
 * batting first in `innings[0]`, so the chase target is `first.runs + 1`.
 */
export function matchOutcome(innings: Innings[]): Outcome {
  if (innings.length < 2) return { winner: null, tied: false, complete: false };
  const [first, second] = innings;
  const complete = first.done && second.done;
  if (!complete) return { winner: null, tied: false, complete: false };
  const target = first.runs + 1;
  if (second.runs >= target) {
    return { winner: second.battingTeam, tied: false, complete: true };
  }
  if (second.runs === first.runs) {
    return { winner: null, tied: true, complete: true };
  }
  return { winner: first.battingTeam, tied: false, complete: true };
}

export interface TeamRecord {
  team: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  /** Net run rate: runs per over scored minus runs per over conceded. */
  netRunRate: number;
}

function emptyRecord(team: string): TeamRecord {
  return {
    team,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    points: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    netRunRate: 0,
  };
}

/**
 * Build a points table across a series. Win = 2 points, tie = 1, loss = 0.
 * Incomplete matches are ignored so a live chase never skews the table.
 *
 * Net run rate is charged on the balls actually faced. A side bowled out
 * inside its quota is (strictly) charged the full quota, but the over limit is
 * not stored on the innings, so we use the overs faced as the fairest proxy.
 */
export function standings(matches: SeriesMatch[]): TeamRecord[] {
  const table = new Map<string, TeamRecord>();

  for (const match of matches) {
    const outcome = matchOutcome(match.innings);
    if (!outcome.complete || match.innings.length < 2) continue;

    for (let i = 0; i < 2; i += 1) {
      const own = match.innings[i];
      const opp = match.innings[1 - i];
      const record = table.get(own.battingTeam) ?? emptyRecord(own.battingTeam);

      record.played += 1;
      record.runsFor += own.runs;
      record.ballsFaced += own.legalBalls;
      record.runsAgainst += opp.runs;
      record.ballsBowled += opp.legalBalls;
      if (outcome.tied) record.tied += 1;
      else if (outcome.winner === own.battingTeam) record.won += 1;
      else record.lost += 1;

      table.set(own.battingTeam, record);
    }
  }

  const rows = Array.from(table.values());
  for (const row of rows) {
    row.points = row.won * 2 + row.tied;
    const scored = row.ballsFaced > 0 ? row.runsFor / (row.ballsFaced / 6) : 0;
    const conceded = row.ballsBowled > 0 ? row.runsAgainst / (row.ballsBowled / 6) : 0;
    row.netRunRate = scored - conceded;
  }

  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.netRunRate - a.netRunRate ||
      a.team.localeCompare(b.team)
  );
}

/** "+0.542" / "-1.203" — the signed NRR label used in the table. */
export function formatNetRunRate(value: number): string {
  const fixed = value.toFixed(3);
  return value > 0 ? `+${fixed}` : fixed;
}
