export type ExtraType = "wd" | "nb";

export type WicketType =
  | "Bowled"
  | "Caught"
  | "LBW"
  | "Run Out"
  | "Stumped"
  | "Hit Wicket"
  | "Gully Rule";

export type RuleEffect =
  | { kind: "runs"; runs: number }
  | { kind: "out"; penalty: number };

export interface GullyRule {
  id: string;
  label: string;
  description: string;
  effect: RuleEffect;
}

export const RULE_PRESETS: GullyRule[] = [
  {
    id: "one-tip",
    label: "One-Tip Catch",
    description: "Caught off a single tip is out",
    effect: { kind: "out", penalty: 0 },
  },
  {
    id: "boundary-out",
    label: "Over Boundary = Out",
    description: "Clearing the boundary line is out",
    effect: { kind: "out", penalty: 0 },
  },
  {
    id: "wall-hit",
    label: "Wall Hit",
    description: "Ball hits the wall — 1 run",
    effect: { kind: "runs", runs: 1 },
  },
  {
    id: "window-hit",
    label: "Window Hit",
    description: "Hits a neighbour's window — out + 2 penalty runs",
    effect: { kind: "out", penalty: 2 },
  },
];

export const VENUES = ["Street / Gully", "Box", "Turf", "Ground"] as const;

export function formatForOvers(overs: number): string {
  if (overs <= 7) return "Mini Match";
  if (overs <= 15) return "T10";
  if (overs <= 25) return "T20";
  if (overs <= 39) return "Half Day";
  return "One Day";
}

export function oversString(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function maxWickets(battingOrderLength: number): number {
  return Math.max(1, battingOrderLength - 1);
}

export interface Batter {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: WicketType | null;
}

export interface Bowler {
  name: string;
  balls: number;
  runs: number;
  wickets: number;
}

export interface BallEvent {
  id: number;
  label: string;
  detail: string;
  legal: boolean;
  runs: number;
  wicket: WicketType | null;
  striker: string;
  bowler: string | null;
  overText: string;
}

export interface Innings {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: { wd: number; nb: number; penalty: number };
  batters: Batter[];
  order: string[];
  nextIndex: number;
  striker: number;
  nonStriker: number;
  bowler: string | null;
  bowlers: Bowler[];
  events: BallEvent[];
  fow: string[];
  done: boolean;
}

export interface BallInput {
  runs: number;
  extra?: ExtraType;
  wicket?: WicketType;
  ruleLabel?: string;
  penalty?: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function makeInnings(
  battingTeam: string,
  bowlingTeam: string,
  order: string[],
  bowlers: string[]
): Innings {
  return {
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, penalty: 0 },
    batters: order.map((name) => ({
      name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: null,
    })),
    order,
    nextIndex: Math.min(2, order.length),
    striker: 0,
    nonStriker: order.length > 1 ? 1 : -1,
    bowler: null,
    bowlers: bowlers.map((name) => ({
      name,
      balls: 0,
      runs: 0,
      wickets: 0,
    })),
    events: [],
    fow: [],
    done: false,
  };
}

export function applyBall(
  innings: Innings,
  input: BallInput,
  oversLimit: number,
  target: number | null
): Innings {
  const next = clone(innings);
  if (next.done) return next;

  const legal = !input.extra;
  const batRuns = input.runs;
  const batter = next.batters[next.striker];
  const bowlerName = next.bowler;
  const bowler = next.bowlers.find((b) => b.name === bowlerName);
  const penalty = input.penalty ?? 0;

  const teamRuns = batRuns + (legal ? 0 : 1) + penalty;
  next.runs += teamRuns;
  if (penalty) next.extras.penalty += penalty;

  if (legal) {
    next.legalBalls += 1;
    batter.balls += 1;
    batter.runs += batRuns;
    if (batRuns === 4) batter.fours += 1;
    if (batRuns === 6) batter.sixes += 1;
    if (bowler) {
      bowler.balls += 1;
      bowler.runs += batRuns;
    }
  } else if (input.extra === "wd") {
    next.extras.wd += 1;
    if (bowler) bowler.runs += 1;
  } else {
    next.extras.nb += 1;
    batter.balls += 1;
    batter.runs += batRuns;
    if (batRuns === 4) batter.fours += 1;
    if (batRuns === 6) batter.sixes += 1;
    if (bowler) bowler.runs += 1 + batRuns;
  }

  if (input.wicket) {
    next.wickets += 1;
    batter.out = input.wicket;
    if (bowler && input.wicket !== "Run Out") bowler.wickets += 1;
    next.fow.push(
      `${next.runs}/${next.wickets} (${batter.name}, ${oversString(
        next.legalBalls
      )})`
    );
    if (next.wickets >= maxWickets(next.order.length)) {
      next.done = true;
    } else if (next.nextIndex < next.order.length) {
      next.striker = next.nextIndex;
      next.nextIndex += 1;
    } else {
      next.done = true;
    }
  }

  if (next.nonStriker >= 0 && batRuns % 2 === 1) {
    const swap = next.striker;
    next.striker = next.nonStriker;
    next.nonStriker = swap;
  }

  if (legal && next.legalBalls % 6 === 0 && !next.done) {
    if (next.nonStriker >= 0) {
      const swap = next.striker;
      next.striker = next.nonStriker;
      next.nonStriker = swap;
    }
    next.bowler = null;
  }

  if (target !== null && next.runs >= target) next.done = true;
  if (next.legalBalls >= oversLimit * 6) next.done = true;

  const overText = legal
    ? `${Math.floor((next.legalBalls - 1) / 6)}.${((next.legalBalls - 1) % 6) + 1}`
    : `${Math.floor(next.legalBalls / 6)}.${(next.legalBalls % 6) + 1}`;

  const label = input.wicket
    ? input.ruleLabel ?? "W"
    : input.extra === "wd"
    ? "wd"
    : input.extra === "nb"
    ? `nb${batRuns ? `+${batRuns}` : ""}`
    : String(batRuns);

  const detail = input.wicket
    ? input.ruleLabel
      ? `${input.ruleLabel} — ${batter.name} out${penalty ? `, +${penalty} penalty` : ""}`
      : `${input.wicket} — ${batter.name} out`
    : input.extra === "wd"
    ? `Wide, 1 run`
    : input.extra === "nb"
    ? `No ball, ${1 + batRuns} run${1 + batRuns === 1 ? "" : "s"}`
    : `${batRuns} run${batRuns === 1 ? "" : "s"} — ${batter.name}`;

  next.events.push({
    id: next.events.length + 1,
    label,
    detail,
    legal,
    runs: teamRuns,
    wicket: input.wicket ?? null,
    striker: batter.name,
    bowler: bowlerName,
    overText,
  });

  return next;
}

export interface MatchState {
  innings: Innings[];
  current: number;
  target: number | null;
}

export function resultText(match: MatchState): string {
  const [first, second] = match.innings;
  if (!second || !first) return "";
  const target = match.target;
  if (target === null) return "";
  if (second.runs >= target) {
    const left = maxWickets(second.order.length) - second.wickets;
    return `${second.battingTeam} won by ${left} wicket${left === 1 ? "" : "s"}`;
  }
  if (second.runs === target - 1) {
    return "Match tied";
  }
  const margin = target - 1 - second.runs;
  return `${first.battingTeam} won by ${margin} run${margin === 1 ? "" : "s"}`;
}
