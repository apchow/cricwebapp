import type { BallEvent, Innings } from "@/lib/scoring";

/**
 * Per-over summary derived from the persisted ball-by-ball events. This powers
 * the Manhattan chart, the commentary feed and the innings insights, so all
 * three read from the same reconstructed timeline instead of re-walking events.
 */
export interface OverSummary {
  /** 1-based over number. */
  over: number;
  runs: number;
  wickets: number;
  /** Fours and sixes scored off the bat in this over. */
  boundaries: number;
  events: BallEvent[];
}

function isBoundary(event: BallEvent): boolean {
  return (
    !event.wicket && event.legal && (event.runs === 4 || event.runs === 6)
  );
}

/**
 * Group the innings events into overs. Non-legal deliveries (wides, no-balls)
 * belong to the over in progress, so they fold into the same bucket as the
 * legal balls around them.
 */
export function overSummaries(innings: Innings): OverSummary[] {
  const overs: OverSummary[] = [];
  let legalBalls = 0;

  for (const event of innings.events) {
    const index = Math.floor(legalBalls / 6);
    let bucket = overs[index];
    if (!bucket) {
      bucket = { over: index + 1, runs: 0, wickets: 0, boundaries: 0, events: [] };
      overs[index] = bucket;
    }
    bucket.runs += event.runs;
    if (event.wicket) bucket.wickets += 1;
    if (isBoundary(event)) bucket.boundaries += 1;
    bucket.events.push(event);
    if (event.legal) legalBalls += 1;
  }

  return overs;
}

/** Balls with no runs conceded — includes a wicket that cost nothing. */
export function dotBalls(innings: Innings): number {
  return innings.events.filter((event) => event.legal && event.runs === 0).length;
}

/** Fours and sixes hit off the bat across the innings. */
export function boundaryCount(innings: Innings): number {
  return innings.events.filter(isBoundary).length;
}

export interface InningsInsights {
  topScore: { name: string; runs: number; balls: number } | null;
  bestBowl: { name: string; wickets: number; runs: number } | null;
  boundaries: number;
  dots: number;
  highestOver: OverSummary | null;
  tightestOver: OverSummary | null;
  runRate: number;
}

/** Headline talking points for a single innings. */
export function inningsInsights(innings: Innings): InningsInsights {
  let topScore: InningsInsights["topScore"] = null;
  for (const batter of innings.batters) {
    if (batter.balls === 0 && batter.out === null) continue;
    if (!topScore || batter.runs > topScore.runs) {
      topScore = { name: batter.name, runs: batter.runs, balls: batter.balls };
    }
  }

  let bestBowl: InningsInsights["bestBowl"] = null;
  for (const bowler of innings.bowlers) {
    if (bowler.balls === 0 && bowler.wickets === 0) continue;
    const better =
      !bestBowl ||
      bowler.wickets > bestBowl.wickets ||
      (bowler.wickets === bestBowl.wickets && bowler.runs < bestBowl.runs);
    if (better) {
      bestBowl = {
        name: bowler.name,
        wickets: bowler.wickets,
        runs: bowler.runs,
      };
    }
  }

  const overs = overSummaries(innings);
  let highestOver: OverSummary | null = null;
  let tightestOver: OverSummary | null = null;
  for (const over of overs) {
    if (!highestOver || over.runs > highestOver.runs) highestOver = over;
    if (!tightestOver || over.runs < tightestOver.runs) tightestOver = over;
  }

  const runRate =
    innings.legalBalls > 0 ? (innings.runs / innings.legalBalls) * 6 : 0;

  return {
    topScore,
    bestBowl,
    boundaries: boundaryCount(innings),
    dots: dotBalls(innings),
    highestOver,
    tightestOver,
    runRate,
  };
}

export interface CommentaryLine {
  overText: string;
  label: string;
  detail: string;
  wicket: boolean;
  boundary: boolean;
  runs: number;
}

/**
 * A readable ball-by-ball feed grouped by over. The scorer already stores a
 * human `detail` for every delivery, so this is a presentation pass rather
 * than a second scoring engine.
 */
export function commentary(
  innings: Innings
): { over: number; lines: CommentaryLine[] }[] {
  return overSummaries(innings).map((over) => ({
    over: over.over,
    lines: over.events.map((event) => ({
      overText: event.overText,
      label: event.label,
      detail: event.detail,
      wicket: event.wicket !== null,
      boundary: isBoundary(event),
      runs: event.runs,
    })),
  }));
}
