import { test } from "node:test";
import assert from "node:assert/strict";

import { makeInnings, type Innings } from "../src/lib/scoring.ts";
import { formatNetRunRate, matchOutcome, standings } from "../src/lib/series.ts";

const ORDER = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11"];

function innings(
  battingTeam: string,
  bowlingTeam: string,
  runs: number,
  wickets: number,
  legalBalls: number,
  done: boolean
): Innings {
  const value = makeInnings(battingTeam, bowlingTeam, ORDER, ["P1"]);
  value.runs = runs;
  value.wickets = wickets;
  value.legalBalls = legalBalls;
  value.done = done;
  return value;
}

const IND_120 = innings("IND", "AUS", 120, 6, 72, true);
const AUS_100 = innings("AUS", "IND", 100, 10, 66, true);
const AUS_140 = innings("AUS", "IND", 140, 5, 72, true);
const IND_120b = innings("IND", "AUS", 120, 8, 72, true);

/* ─── matchOutcome ──────────────────────────────────────── */

test("matchOutcome credits a successful chase to the batting side", () => {
  const chase = matchOutcome([IND_120, innings("AUS", "IND", 121, 4, 70, true)]);
  assert.equal(chase.complete, true);
  assert.equal(chase.winner, "AUS");
  assert.equal(chase.tied, false);
});

test("matchOutcome credits a win by runs to the side batting first", () => {
  const result = matchOutcome([IND_120, AUS_100]);
  assert.equal(result.winner, "IND");
  assert.equal(result.tied, false);
});

test("matchOutcome reports a tie", () => {
  const result = matchOutcome([IND_120, innings("AUS", "IND", 120, 7, 72, true)]);
  assert.equal(result.tied, true);
  assert.equal(result.winner, null);
  assert.equal(result.complete, true);
});

test("matchOutcome ignores a match still in progress", () => {
  const result = matchOutcome([
    IND_120,
    innings("AUS", "IND", 40, 2, 24, false),
  ]);
  assert.equal(result.complete, false);
});

/* ─── standings ─────────────────────────────────────────── */

test("standings awards two points per win and orders by NRR", () => {
  const table = standings([
    { id: "m1", createdAt: "2026-01-02", innings: [IND_120, AUS_100] },
    { id: "m2", createdAt: "2026-01-03", innings: [AUS_140, IND_120b] },
  ]);

  assert.equal(table.length, 2);
  assert.equal(table[0].team, "AUS");
  assert.equal(table[0].points, 2);
  assert.equal(table[0].won, 1);
  assert.equal(table[0].lost, 1);
  assert.equal(table[0].played, 2);
  assert.ok(Math.abs(table[0].netRunRate - 0.4348) < 0.001);
  assert.equal(table[1].team, "IND");
  assert.ok(Math.abs(table[1].netRunRate + 0.4348) < 0.001);
});

test("standings skips matches that are not finished", () => {
  const table = standings([
    { id: "m1", createdAt: "2026-01-02", innings: [IND_120, AUS_100] },
    {
      id: "m2",
      createdAt: "2026-01-03",
      innings: [AUS_140, innings("IND", "AUS", 30, 1, 18, false)],
    },
  ]);
  assert.equal(table.length, 2);
  assert.equal(table.find((row) => row.team === "AUS")?.played, 1);
});

test("standings returns an empty table for no matches", () => {
  assert.deepEqual(standings([]), []);
});

/* ─── formatting ────────────────────────────────────────── */

test("formatNetRunRate signs positive rates", () => {
  assert.equal(formatNetRunRate(0.4348), "+0.435");
  assert.equal(formatNetRunRate(-0.5), "-0.500");
  assert.equal(formatNetRunRate(0), "0.000");
});
