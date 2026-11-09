import { test } from "node:test";
import assert from "node:assert/strict";

import { applyBall, makeInnings, type Innings } from "../src/lib/scoring.ts";
import {
  activityStreak,
  battingAverage,
  battingStats,
  bowlingAverage,
  bowlingStats,
  economy,
  strikeRate,
} from "../src/lib/stats.ts";

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

/* ─── batting ───────────────────────────────────────────── */

test("battingStats aggregates runs and balls for everyone who batted", () => {
  const innings = play([
    { runs: 4 },
    { runs: 1 },
    { runs: 2 },
    { runs: 6 },
  ]);
  const rows = battingStats([{ innings: [innings] }]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "A2");
  assert.equal(rows[0].runs, 8);
  assert.equal(rows[0].sixes, 1);
  assert.equal(rows[1].name, "A1");
  assert.equal(rows[1].runs, 5);
  assert.equal(rows[1].balls, 2);
  assert.equal(rows[1].fours, 1);
  assert.equal(rows[1].notOuts, 1);
  assert.equal(rows[1].outs, 0);
});

test("battingStats skips players who never reached the crease", () => {
  const innings = play([{ runs: 1 }]);
  const rows = battingStats([{ innings: [innings] }]);
  const names = rows.map((row) => row.name).sort();
  assert.deepEqual(names, ["A1", "A2"]);
});

test("battingStats tracks milestone, ducks and averages", () => {
  const innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  innings.batters[0].runs = 62;
  innings.batters[0].balls = 40;
  innings.batters[0].out = "Bowled";
  innings.batters[1].runs = 104;
  innings.batters[1].balls = 60;
  innings.batters[2].runs = 0;
  innings.batters[2].balls = 3;
  innings.batters[2].out = "Caught";

  const rows = battingStats([{ innings: [innings] }]);
  const byName = new Map(rows.map((row) => [row.name, row]));

  assert.equal(rows.length, 3);
  assert.equal(byName.get("A2")?.hundreds, 1);
  assert.equal(byName.get("A2")?.fifties, 0);
  assert.equal(byName.get("A1")?.fifties, 1);
  assert.equal(byName.get("A3")?.ducks, 1);
  assert.equal(battingAverage(byName.get("A1")!), 62);
  assert.equal(battingAverage(byName.get("A2")!), null);
  assert.equal(strikeRate(byName.get("A1")!), 155);
});

test("battingStats sums career figures across matches", () => {
  const first = makeInnings("IND", "AUS", ORDER, BOWLERS);
  first.batters[0].runs = 30;
  first.batters[0].balls = 20;
  const second = makeInnings("IND", "AUS", ORDER, BOWLERS);
  second.batters[0].runs = 45;
  second.batters[0].balls = 30;
  second.batters[0].out = "LBW";

  const row = battingStats([{ innings: [first] }, { innings: [second] }]).find(
    (item) => item.name === "A1"
  )!;

  assert.equal(row.innings, 2);
  assert.equal(row.runs, 75);
  assert.equal(row.balls, 50);
  assert.equal(row.highScore, 45);
  assert.equal(row.outs, 1);
  assert.equal(row.notOuts, 1);
  assert.equal(battingAverage(row), 75);
});

test("a returning batter is out once per dismissal, not once per innings", () => {
  let innings = makeInnings("Arjun", "Ravi", ["Arjun"], ["Ravi"], 3);
  innings.bowler = "Ravi";
  const unlimited = Number.POSITIVE_INFINITY;
  innings = applyBall(innings, { runs: 6 }, unlimited, null);
  innings = applyBall(innings, { runs: 0, wicket: "Bowled" }, unlimited, null);
  innings = applyBall(innings, { runs: 4 }, unlimited, null);
  innings = applyBall(innings, { runs: 0, wicket: "Caught" }, unlimited, null);
  innings = applyBall(innings, { runs: 2 }, unlimited, null);
  innings = applyBall(innings, { runs: 0, wicket: "LBW" }, unlimited, null);

  const row = battingStats([{ innings: [innings] }]).find(
    (item) => item.name === "Arjun"
  )!;
  assert.equal(row.innings, 1);
  assert.equal(row.runs, 12);
  assert.equal(row.outs, 3);
  assert.equal(row.notOuts, 0);
  assert.equal(battingAverage(row), 4);

  const spell = bowlingStats([{ innings: [innings] }]).find(
    (item) => item.name === "Ravi"
  )!;
  assert.equal(spell.wickets, 3);
});

/* ─── bowling ───────────────────────────────────────────── */

test("bowlingStats keeps the best spell and sorts by wickets", () => {
  const innings = makeInnings("IND", "AUS", ORDER, BOWLERS);
  innings.bowlers[0].balls = 12;
  innings.bowlers[0].runs = 24;
  innings.bowlers[0].wickets = 2;
  innings.bowlers[1].balls = 6;
  innings.bowlers[1].runs = 3;
  innings.bowlers[1].wickets = 3;

  const rows = bowlingStats([{ innings: [innings] }]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "P2");
  assert.equal(rows[0].bestWickets, 3);
  assert.equal(rows[0].bestRuns, 3);
  assert.equal(rows[1].name, "P1");
  assert.equal(economy(rows[1]), 12);
  assert.equal(bowlingAverage(rows[1]), 12);
  assert.equal(bowlingAverage(rows[0]), 1);
});

test("bowlingStats picks the best of several spells", () => {
  const first = makeInnings("IND", "AUS", ORDER, BOWLERS);
  first.bowlers[0].balls = 6;
  first.bowlers[0].runs = 20;
  first.bowlers[0].wickets = 1;
  const second = makeInnings("IND", "AUS", ORDER, BOWLERS);
  second.bowlers[0].balls = 12;
  second.bowlers[0].runs = 10;
  second.bowlers[0].wickets = 4;

  const row = bowlingStats([{ innings: [first] }, { innings: [second] }]).find(
    (item) => item.name === "P1"
  )!;

  assert.equal(row.innings, 2);
  assert.equal(row.wickets, 5);
  assert.equal(row.balls, 18);
  assert.equal(row.runs, 30);
  assert.equal(row.bestWickets, 4);
  assert.equal(row.bestRuns, 10);
});

test("bowlingStats ignores bowlers who never delivered", () => {
  const innings = play([{ runs: 1 }]);
  const rows = bowlingStats([{ innings: [innings] }]);
  assert.deepEqual(rows.map((row) => row.name), ["P1"]);
});

/* ─── retention ─────────────────────────────────────────── */

test("activityStreak counts consecutive days up to today", () => {
  const now = new Date("2026-05-10T12:00:00Z");
  const dates = [
    "2026-05-10T08:00:00Z",
    "2026-05-09T21:30:00Z",
    "2026-05-08T06:00:00Z",
    "2026-05-06T06:00:00Z",
  ];
  assert.equal(activityStreak(dates, now), 3);
});

test("activityStreak treats yesterday as still alive", () => {
  const now = new Date("2026-05-10T12:00:00Z");
  assert.equal(activityStreak(["2026-05-09T12:00:00Z"], now), 1);
  assert.equal(activityStreak([], now), 0);
});

test("activityStreak is zero once the gap reaches two days", () => {
  const now = new Date("2026-05-10T12:00:00Z");
  assert.equal(activityStreak(["2026-05-08T12:00:00Z"], now), 0);
});
