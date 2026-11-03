import { test } from "node:test";
import assert from "node:assert/strict";

import { applyBall, makeInnings, type Innings } from "../src/lib/scoring.ts";
import {
  boundaryCount,
  commentary,
  dotBalls,
  inningsInsights,
  overSummaries,
} from "../src/lib/insights.ts";

const ORDER = ["A1", "A2", "A3", "A4"];
const BOWLERS = ["P1", "P2"];

function play(
  balls: Parameters<typeof applyBall>[1][],
  oversLimit = 5
): Innings {
  let innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  innings.bowler = "P1";
  for (const ball of balls) innings = applyBall(innings, ball, oversLimit, null);
  return innings;
}

/* ─── overSummaries ─────────────────────────────────────── */

test("overSummaries buckets deliveries into overs by legal balls", () => {
  const innings = play([
    { runs: 1 },
    { runs: 4 },
    { runs: 0 },
    { runs: 6 },
    { runs: 2 },
    { runs: 1 },
    { runs: 3 },
  ]);
  const overs = overSummaries(innings);

  assert.equal(overs.length, 2);
  assert.equal(overs[0].over, 1);
  assert.equal(overs[0].runs, 14);
  assert.equal(overs[0].wickets, 0);
  assert.equal(overs[0].boundaries, 2);
  assert.equal(overs[1].over, 2);
  assert.equal(overs[1].runs, 3);
});

test("overSummaries folds wides into the over in progress", () => {
  const innings = play([
    { runs: 0, extra: "wd" },
    { runs: 0, extra: "wd" },
    { runs: 1 },
    { runs: 1 },
    { runs: 1 },
    { runs: 1 },
    { runs: 1 },
    { runs: 1 },
  ]);
  const overs = overSummaries(innings);

  assert.equal(overs.length, 1);
  assert.equal(overs[0].runs, 8);
  assert.equal(overs[0].events.length, 8);
});

test("overSummaries counts wickets against the over they fall in", () => {
  const innings = play([{ runs: 0, wicket: "Bowled" }, { runs: 4 }]);
  const overs = overSummaries(innings);
  assert.equal(overs[0].wickets, 1);
  assert.equal(overs[0].boundaries, 1);
});

/* ─── counting helpers ──────────────────────────────────── */

test("dotBalls and boundaryCount count the right deliveries", () => {
  const innings = play([
    { runs: 0 },
    { runs: 4 },
    { runs: 0, extra: "wd" },
    { runs: 6 },
    { runs: 1 },
    { runs: 0 },
  ]);
  assert.equal(dotBalls(innings), 2);
  assert.equal(boundaryCount(innings), 2);
});

/* ─── commentary ────────────────────────────────────────── */

test("commentary groups lines by over and flags boundaries", () => {
  const innings = play([{ runs: 4 }, { runs: 1 }]);
  const feed = commentary(innings);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].over, 1);
  assert.equal(feed[0].lines.length, 2);
  assert.equal(feed[0].lines[0].boundary, true);
  assert.equal(feed[0].lines[1].boundary, false);
});

/* ─── inningsInsights ───────────────────────────────────── */

test("inningsInsights surfaces the top score, best spell and run rate", () => {
  const innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  innings.runs = 120;
  innings.legalBalls = 12;
  innings.batters[0].runs = 45;
  innings.batters[0].balls = 30;
  innings.batters[1].runs = 70;
  innings.batters[1].balls = 40;
  innings.bowlers[0].balls = 6;
  innings.bowlers[0].runs = 30;
  innings.bowlers[0].wickets = 1;
  innings.bowlers[1].balls = 6;
  innings.bowlers[1].runs = 20;
  innings.bowlers[1].wickets = 3;

  const insight = inningsInsights(innings);
  assert.equal(insight.topScore?.name, "A2");
  assert.equal(insight.topScore?.runs, 70);
  assert.equal(insight.bestBowl?.name, "P2");
  assert.equal(insight.bestBowl?.wickets, 3);
  assert.equal(insight.runRate, 60);
  assert.equal(insight.highestOver, null);
});

test("inningsInsights finds the highest and tightest over", () => {
  const innings = play([
    { runs: 4 },
    { runs: 0 },
    { runs: 0 },
    { runs: 6 },
    { runs: 0 },
    { runs: 1 },
    { runs: 2 },
    { runs: 0 },
    { runs: 0 },
    { runs: 0 },
    { runs: 0 },
    { runs: 0 },
  ]);
  const insight = inningsInsights(innings);
  assert.equal(insight.highestOver?.over, 1);
  assert.equal(insight.highestOver?.runs, 11);
  assert.equal(insight.tightestOver?.over, 2);
  assert.equal(insight.tightestOver?.runs, 2);
});
