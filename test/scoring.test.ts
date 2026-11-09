import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyBall,
  expectedInnings,
  formatForOvers,
  formatLabel,
  isSettled,
  makeInnings,
  maxWickets,
  oversString,
  resultText,
  scoreline,
  teamRuns,
  type Innings,
  type MatchState,
} from "../src/lib/scoring.ts";

const ORDER = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "A9",
  "A10",
  "A11",
];
const BOWLERS = ["P1", "P2"];

function fresh(): Innings {
  const innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  innings.bowler = "P1";
  return innings;
}

/* ─── makeInnings ───────────────────────────────────────── */

test("makeInnings sets up openers, bowlers and empty extras", () => {
  const innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  assert.equal(innings.runs, 0);
  assert.equal(innings.wickets, 0);
  assert.equal(innings.legalBalls, 0);
  assert.equal(innings.striker, 0);
  assert.equal(innings.nonStriker, 1);
  assert.equal(innings.nextIndex, 2);
  assert.equal(innings.bowler, null);
  assert.equal(innings.lastBowler, null);
  assert.equal(innings.done, false);
  assert.equal(innings.batters.length, 11);
  assert.equal(innings.bowlers.length, 2);
  assert.deepEqual(innings.extras, { wd: 0, nb: 0, b: 0, lb: 0, penalty: 0 });
});

test("makeInnings handles a single-batter order", () => {
  const innings = makeInnings("IND", "AUS", ["Solo"], BOWLERS);
  assert.equal(innings.striker, 0);
  assert.equal(innings.nonStriker, -1);
  assert.equal(innings.nextIndex, 1);
});

/* ─── runs & strike rotation ────────────────────────────── */

test("a single rotates strike and credits batter and bowler", () => {
  const next = applyBall(fresh(), { runs: 1 }, 20, null);
  assert.equal(next.runs, 1);
  assert.equal(next.legalBalls, 1);
  assert.equal(next.batters[0].runs, 1);
  assert.equal(next.batters[0].balls, 1);
  assert.equal(next.striker, 1);
  assert.equal(next.nonStriker, 0);
  const bowler = next.bowlers.find((b) => b.name === "P1");
  assert.equal(bowler?.runs, 1);
  assert.equal(bowler?.balls, 1);
});

test("a boundary keeps the striker on strike and counts fours/sixes", () => {
  const four = applyBall(fresh(), { runs: 4 }, 20, null);
  assert.equal(four.batters[0].fours, 1);
  assert.equal(four.striker, 0);

  const six = applyBall(fresh(), { runs: 6 }, 20, null);
  assert.equal(six.batters[0].sixes, 1);
  assert.equal(six.striker, 0);
});

test("applyBall does not mutate the input innings", () => {
  const innings = fresh();
  applyBall(innings, { runs: 4 }, 20, null);
  assert.equal(innings.runs, 0);
  assert.equal(innings.legalBalls, 0);
  assert.equal(innings.batters[0].runs, 0);
});

test("strike rotates back after an odd run from the non-striker end", () => {
  const twoSingles = applyBall(
    applyBall(fresh(), { runs: 1 }, 20, null),
    { runs: 1 },
    20,
    null
  );
  assert.equal(twoSingles.runs, 2);
  assert.equal(twoSingles.striker, 0);
  assert.equal(twoSingles.nonStriker, 1);
});

/* ─── extras ────────────────────────────────────────────── */

test("a wide adds one run, charges the bowler and is not a legal ball", () => {
  const next = applyBall(fresh(), { runs: 0, extra: "wd" }, 20, null);
  assert.equal(next.runs, 1);
  assert.equal(next.extras.wd, 1);
  assert.equal(next.legalBalls, 0);
  assert.equal(next.batters[0].balls, 0);
  assert.equal(next.batters[0].runs, 0);
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.runs, 1);
  assert.equal(next.events.at(-1)?.label, "wd");
});

test("a wide with extra runs counts each run as a wide", () => {
  const next = applyBall(fresh(), { runs: 2, extra: "wd" }, 20, null);
  assert.equal(next.runs, 3);
  assert.equal(next.extras.wd, 3);
  assert.equal(next.legalBalls, 0);
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.runs, 3);
  assert.equal(next.events.at(-1)?.label, "wd+2");
});

test("a no-ball adds one run and the batter still faces the delivery", () => {
  const next = applyBall(fresh(), { runs: 0, extra: "nb" }, 20, null);
  assert.equal(next.runs, 1);
  assert.equal(next.extras.nb, 1);
  assert.equal(next.legalBalls, 0);
  assert.equal(next.batters[0].balls, 1);
  assert.equal(next.batters[0].runs, 0);
});

test("runs off a no-ball go to the batter and are charged to the bowler", () => {
  const next = applyBall(fresh(), { runs: 4, extra: "nb" }, 20, null);
  assert.equal(next.runs, 5);
  assert.equal(next.extras.nb, 1);
  assert.equal(next.batters[0].runs, 4);
  assert.equal(next.batters[0].fours, 1);
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.runs, 5);
  assert.equal(next.events.at(-1)?.label, "nb+4");
});

test("byes are legal, count as extras and are not charged to the bowler", () => {
  const next = applyBall(fresh(), { runs: 2, extra: "b" }, 20, null);
  assert.equal(next.runs, 2);
  assert.equal(next.extras.b, 2);
  assert.equal(next.legalBalls, 1);
  assert.equal(next.batters[0].balls, 1);
  assert.equal(next.batters[0].runs, 0);
  const bowler = next.bowlers.find((b) => b.name === "P1");
  assert.equal(bowler?.runs, 0);
  assert.equal(bowler?.balls, 1);
  assert.equal(next.events.at(-1)?.label, "2b");
});

test("a single leg bye rotates the strike", () => {
  const next = applyBall(fresh(), { runs: 1, extra: "lb" }, 20, null);
  assert.equal(next.extras.lb, 1);
  assert.equal(next.legalBalls, 1);
  assert.equal(next.striker, 1);
  assert.equal(next.nonStriker, 0);
  assert.equal(next.events.at(-1)?.label, "1lb");
});

test("penalty runs are added to the total and to extras", () => {
  const next = applyBall(fresh(), { runs: 0, penalty: 5 }, 20, null);
  assert.equal(next.runs, 5);
  assert.equal(next.extras.penalty, 5);
  assert.equal(next.legalBalls, 1);
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.runs, 0);
});

/* ─── wickets ───────────────────────────────────────────── */

test("a bowled wicket credits the bowler and brings in the next batter", () => {
  const next = applyBall(fresh(), { runs: 0, wicket: "Bowled" }, 20, null);
  assert.equal(next.wickets, 1);
  assert.equal(next.batters[0].out, "Bowled");
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.wickets, 1);
  assert.equal(next.striker, 2);
  assert.equal(next.nextIndex, 3);
  assert.equal(next.nonStriker, 1);
  assert.equal(next.fow.length, 1);
});

test("a run out does not credit the bowler", () => {
  const next = applyBall(fresh(), { runs: 0, wicket: "Run Out" }, 20, null);
  assert.equal(next.wickets, 1);
  assert.equal(next.bowlers.find((b) => b.name === "P1")?.wickets, 0);
});

test("the innings ends once all out", () => {
  let innings = fresh();
  for (let i = 0; i < maxWickets(ORDER.length); i += 1) {
    innings = applyBall(innings, { runs: 0, wicket: "Bowled" }, 50, null);
  }
  assert.equal(innings.wickets, 10);
  assert.equal(innings.done, true);
});

/* ─── overs & bowler rotation ───────────────────────────── */

test("completing an over rotates the strike and clears the bowler", () => {
  let innings = fresh();
  for (let i = 0; i < 6; i += 1) {
    innings = applyBall(innings, { runs: 0 }, 20, null);
  }
  assert.equal(innings.legalBalls, 6);
  assert.equal(innings.lastBowler, "P1");
  assert.equal(innings.bowler, null);
  assert.equal(innings.striker, 1);
  assert.equal(innings.nonStriker, 0);
});

test("lastBowler is only recorded when the over is completed by a legal ball", () => {
  let innings = fresh();
  for (let i = 0; i < 5; i += 1) {
    innings = applyBall(innings, { runs: 0 }, 20, null);
  }
  innings = applyBall(innings, { runs: 0, extra: "wd" }, 20, null);
  assert.equal(innings.legalBalls, 5);
  assert.equal(innings.lastBowler, null);
  assert.equal(innings.bowler, "P1");
});

/* ─── innings / match termination ───────────────────────── */

test("the innings ends when the target is reached", () => {
  const next = applyBall(fresh(), { runs: 5 }, 20, 5);
  assert.equal(next.runs, 5);
  assert.equal(next.done, true);
});

test("the innings ends at the over limit", () => {
  let innings = fresh();
  for (let i = 0; i < 6; i += 1) {
    innings = applyBall(innings, { runs: 0 }, 1, null);
  }
  assert.equal(innings.legalBalls, 6);
  assert.equal(innings.done, true);
});

test("balls after the innings is done are ignored", () => {
  const done = applyBall(fresh(), { runs: 5 }, 20, 5);
  const after = applyBall(done, { runs: 4 }, 20, 5);
  assert.equal(after.runs, 5);
  assert.equal(after.events.length, 1);
});

/* ─── helpers ───────────────────────────────────────────── */

test("formatForOvers maps overs to formats", () => {
  assert.equal(formatForOvers(5), "Mini Match");
  assert.equal(formatForOvers(7), "Mini Match");
  assert.equal(formatForOvers(10), "T10");
  assert.equal(formatForOvers(15), "T10");
  assert.equal(formatForOvers(20), "T20");
  assert.equal(formatForOvers(25), "T20");
  assert.equal(formatForOvers(30), "Half Day");
  assert.equal(formatForOvers(39), "Half Day");
  assert.equal(formatForOvers(50), "One Day");
});

test("oversString renders completed overs and balls", () => {
  assert.equal(oversString(0), "0.0");
  assert.equal(oversString(6), "1.0");
  assert.equal(oversString(7), "1.1");
  assert.equal(oversString(13), "2.1");
});

test("maxWickets keeps at least one batter", () => {
  assert.equal(maxWickets(11), 10);
  assert.equal(maxWickets(2), 1);
  assert.equal(maxWickets(1), 1);
  assert.equal(maxWickets(0), 1);
});

test("resultText describes a successful chase", () => {
  const match: MatchState = {
    innings: [
      makeInnings("IND", "AUS", ORDER, BOWLERS),
      { ...makeInnings("AUS", "IND", ORDER, BOWLERS), runs: 161, wickets: 2, done: true },
    ],
    current: 1,
    target: 161,
  };
  assert.equal(resultText(match), "AUS won by 8 wickets");
});

test("resultText describes a tie", () => {
  const match: MatchState = {
    innings: [
      makeInnings("IND", "AUS", ORDER, BOWLERS),
      { ...makeInnings("AUS", "IND", ORDER, BOWLERS), runs: 160, wickets: 8, done: true },
    ],
    current: 1,
    target: 161,
  };
  assert.equal(resultText(match), "Match tied");
});

test("resultText describes a win by runs", () => {
  const match: MatchState = {
    innings: [
      makeInnings("IND", "AUS", ORDER, BOWLERS),
      { ...makeInnings("AUS", "IND", ORDER, BOWLERS), runs: 140, wickets: 10, done: true },
    ],
    current: 1,
    target: 161,
  };
  assert.equal(resultText(match), "IND won by 20 runs");
});

/* ─── Test matches ──────────────────────────────────────── */

const closed = (
  battingTeam: string,
  bowlingTeam: string,
  runs: number,
  wickets: number,
  extra: Partial<Innings> = {}
): Innings => ({
  ...makeInnings(battingTeam, bowlingTeam, ORDER, BOWLERS),
  runs,
  wickets,
  legalBalls: 240,
  done: true,
  ...extra,
});

/** IND 300 + 200, AUS 250 then chasing 251. */
function fourInnings(chase: Partial<Innings>): MatchState {
  return {
    innings: [
      closed("IND", "AUS", 300, 10),
      closed("AUS", "IND", 250, 10),
      closed("IND", "AUS", 200, 8),
      { ...closed("AUS", "IND", 0, 0), done: false, ...chase },
    ],
    current: 3,
    target: 251,
    isTest: true,
  };
}

test("a Test innings is not ended by an over count", () => {
  const innings = closed("IND", "AUS", 0, 0, { done: false, legalBalls: 0 });
  const after = applyBall(innings, { runs: 1 }, Number.POSITIVE_INFINITY, null);
  assert.equal(after.done, false);
  assert.equal(after.legalBalls, 1);
});

test("expectedInnings is four for a Test and two otherwise", () => {
  assert.equal(expectedInnings({ innings: [], current: 0, target: null, isTest: true }), 4);
  assert.equal(expectedInnings({ innings: [], current: 0, target: null }), 2);
});

test("a Test is undecided until the fourth innings is done", () => {
  const partway = fourInnings({ done: false });
  partway.innings = partway.innings.slice(0, 3);
  partway.current = 2;
  assert.equal(isSettled(partway), false);
  assert.equal(resultText(partway), "");
});

test("teamRuns totals a side across its innings", () => {
  assert.equal(teamRuns(fourInnings({ done: false }), "IND"), 500);
  assert.equal(teamRuns(fourInnings({ done: false }), "AUS"), 250);
});

test("resultText reports a Test won by runs on the aggregate", () => {
  // AUS 250 + 240 = 490 against IND's 500, chasing a further 251.
  const match = fourInnings({ runs: 240, wickets: 10, done: true });
  assert.equal(resultText(match), "IND won by 10 runs");
});

test("resultText reports a Test won by wickets", () => {
  const match = fourInnings({ runs: 260, wickets: 4, done: true });
  assert.equal(resultText(match), "AUS won by 6 wickets");
});

test("a Test still batting when time runs out is drawn", () => {
  const match = fourInnings({ runs: 180, wickets: 6 });
  match.complete = true;
  assert.equal(resultText(match), "Drawn");
});

test("a tie needs the chase to land exactly one short", () => {
  const match = fourInnings({ runs: 250, wickets: 10, done: true });
  assert.equal(resultText(match), "Match tied");
});

test("formatLabel calls a Test a Test whatever the overs", () => {
  assert.equal(formatLabel(6, true), "Test");
  assert.equal(formatLabel(6, false), formatForOvers(6));
});

test("scoreline marks a declaration and drops an unlimited cap", () => {
  const match = fourInnings({ runs: 240, wickets: 10, done: true });
  match.innings[2] = { ...match.innings[2], declared: true };
  const line = scoreline(match, () => Number.POSITIVE_INFINITY);
  assert.match(line, /IND 200\/8 d \(40\.0\)/);
  assert.doesNotMatch(line, /\(40\.0\/\d+\)/, "no overs cap shown when the innings is uncapped");
  assert.equal(match.innings.length, 4);

  const capped = scoreline(match, (index) => (index === 1 ? 20 : 50));
  assert.match(capped, /\(40\.0\/50\)/);
  assert.match(capped, /\(40\.0\/20\)/);
});
