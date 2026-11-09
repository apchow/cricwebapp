import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanConfig, cleanMatch, cleanMatchEntry } from "../src/lib/validate.ts";
import { makeInnings } from "../src/lib/scoring.ts";

const ORDER = ["A1", "A2", "A3"];
const BOWLERS = ["B1", "B2"];

const inn = (battingTeam: string, bowlingTeam: string, extra = {}) => ({
  ...makeInnings(battingTeam, bowlingTeam, ORDER, BOWLERS),
  ...extra,
});

/**
 * These are the API boundary's own rules, and they once capped every match at
 * two innings — so a Test lost innings three and four on its way to storage
 * while the scoreline, built client-side, still described all of them.
 */
test("cleanMatch keeps all four innings of a Test", () => {
  const clean = cleanMatch({
    innings: [
      inn("IND", "AUS"),
      inn("AUS", "IND"),
      inn("IND", "AUS", { declared: true }),
      inn("AUS", "IND", { runs: 40 }),
    ],
    current: 3,
    target: 51,
    isTest: true,
  });
  assert.equal(clean?.innings.length, 4);
  assert.equal(clean?.current, 3);
  assert.equal(clean?.target, 51);
  assert.equal(clean?.isTest, true);
  assert.equal(clean?.innings[2].declared, true);
});

test("cleanMatch refuses more than four innings", () => {
  const five = Array.from({ length: 5 }, (_, i) => inn(`T${i}`, "AUS"));
  const clean = cleanMatch({ innings: five, current: 4, target: null, isTest: true });
  assert.equal(clean?.innings.length, 4);
  // An out-of-range index falls back to the first innings rather than trusting the payload.
  assert.equal(clean?.current, 0);
});

test("a declaration is not dropped on the way to storage", () => {
  const clean = cleanMatch({
    innings: [inn("IND", "AUS", { declared: true, done: true })],
    current: 0,
    target: null,
    isTest: true,
  });
  assert.equal(clean?.innings[0].declared, true);
  assert.equal(clean?.innings[0].done, true);
});

test("an innings longer than sixty overs keeps its ball count", () => {
  const clean = cleanMatch({
    innings: [inn("IND", "AUS", { legalBalls: 540, runs: 300 })],
    current: 0,
    target: null,
    isTest: true,
  });
  assert.equal(clean?.innings[0].legalBalls, 540);
});

test("a recorded Test result survives the round trip", () => {
  const clean = cleanMatch({
    innings: [inn("IND", "AUS", { done: true }), inn("AUS", "IND", { done: true }), inn("IND", "AUS", { done: true })],
    current: 2,
    target: null,
    isTest: true,
    complete: true,
    recordedResult: "AUS won by 4 wickets",
  });
  assert.equal(clean?.complete, true);
  assert.equal(clean?.recordedResult, "AUS won by 4 wickets");
});

test("a limited-overs match gains no Test flags from validation", () => {
  const clean = cleanMatch({
    innings: [inn("IND", "AUS", { done: true }), inn("AUS", "IND")],
    current: 1,
    target: 161,
  });
  assert.equal(clean?.isTest, undefined);
  assert.equal(clean?.complete, undefined);
  assert.equal(clean?.recordedResult, undefined);
});

test("cleanMatchEntry accepts the innings counts a Test can end on", () => {
  for (const count of [2, 3, 4]) {
    const entry = cleanMatchEntry({
      format: "Test",
      venue: "Box",
      scoreline: "IND 300/10 d (90.0) · AUS 250/8 d (80.0)",
      result: count === 2 ? "Drawn" : "IND won by 10 runs",
      innings: Array.from({ length: count }, (_, i) =>
        inn(i % 2 ? "AUS" : "IND", i % 2 ? "IND" : "AUS", { done: true })
      ),
    });
    assert.equal(entry?.innings.length, count, `${count} innings stored`);
  }
});

test("cleanMatchEntry still rejects what is not a match", () => {
  assert.equal(cleanMatchEntry(null), null);
  assert.equal(
    cleanMatchEntry({ format: "", venue: "Box", scoreline: "x", result: "y", innings: [] }),
    null
  );
  assert.equal(
    cleanMatchEntry({ format: "T20", venue: "Box", scoreline: "x", result: "y", innings: "no" }),
    null
  );
});

test("a four-part scoreline is long enough to be kept", () => {
  const team = "Very Long Amateur Cricket Club Name";
  const scoreline = Array.from(
    { length: 4 },
    (_, i) => `${team} ${100 + i}/10 d (9${i}.0)`
  ).join(" · ");
  const entry = cleanMatchEntry({
    format: "Test",
    venue: "Ground",
    scoreline,
    result: "Drawn",
    innings: [
      inn(team, "AUS", { done: true }),
      inn("AUS", team, { done: true }),
      inn(team, "AUS", { done: true }),
      inn("AUS", team, { done: true }),
    ],
  });
  assert.equal(entry?.scoreline, scoreline);
});

test("cleanConfig carries the Test settings through a refresh", () => {
  const clean = cleanConfig({
    teamA: { name: "GK", players: ORDER },
    teamB: { name: "SS", players: ORDER },
    overs: 20,
    testOvers: 0,
    isTest: true,
    venue: "Box",
    ruleIds: ["one-tip"],
  });
  assert.equal(clean?.isTest, true);
  // Zero means "no cap", which is the same as not storing it.
  assert.equal(clean?.testOvers, undefined);

  const capped = cleanConfig({
    teamA: { name: "GK", players: ORDER },
    teamB: { name: "SS", players: ORDER },
    overs: 20,
    testOvers: 12,
    isTest: true,
    venue: "Box",
    ruleIds: [],
  });
  assert.equal(capped?.testOvers, 12);
});

test("a limited-overs config gains no Test fields", () => {
  const clean = cleanConfig({
    teamA: { name: "GK", players: ORDER },
    teamB: { name: "SS", players: ORDER },
    overs: 6,
    venue: "Turf",
    ruleIds: [],
  });
  assert.equal(clean?.isTest, undefined);
  assert.equal(clean?.testOvers, undefined);
  assert.equal(clean?.oneVOne, undefined);
  assert.equal(clean?.wickets, undefined);
});

/* ─── Turf 1 v 1 through the API boundary ───────────────── */

const soloInn = (batting: string, bowling: string, extra = {}) => ({
  ...makeInnings(batting, bowling, [batting], [bowling], 5),
  ...extra,
});

test("cleanConfig carries the 1 v 1 mode and its wicket count", () => {
  const clean = cleanConfig({
    teamA: { name: "Arjun", players: ["Arjun", "Ravi", "Sameer"] },
    teamB: { name: "Ravi", players: ["Ravi", "Dev"] },
    overs: 6,
    isTest: true,
    oneVOne: true,
    wickets: 5,
    venue: "Turf",
    ruleIds: [],
  });
  assert.equal(clean?.oneVOne, true);
  assert.equal(clean?.wickets, 5);
  // The bench is kept, not deleted: turning 1 v 1 off brings the squad back.
  assert.equal(clean?.teamA.players.length, 3);
});

test("cleanConfig refuses a wicket count outside the supported range", () => {
  const base = {
    teamA: { name: "A", players: ORDER },
    teamB: { name: "B", players: ORDER },
    overs: 6,
    venue: "Turf",
    ruleIds: [],
  };
  assert.equal(cleanConfig({ ...base, wickets: 0 })?.wickets, undefined);
  assert.equal(cleanConfig({ ...base, wickets: 51 })?.wickets, undefined);
  assert.equal(cleanConfig({ ...base, wickets: 50 })?.wickets, 50);
  assert.equal(cleanConfig({ ...base, wickets: "3" })?.wickets, 3);
});

test("a lone batter's innings survives storage with its wicket limit", () => {
  const clean = cleanMatch({
    innings: [
      soloInn("Arjun", "Ravi", {
        runs: 84,
        wickets: 4,
        legalBalls: 150,
        fow: Array.from({ length: 4 }, (_, i) => `${i * 20}/${i + 1} (Arjun, ${i}.1)`),
      }),
    ],
    current: 0,
    target: null,
    isTest: true,
  });
  const innings = clean?.innings[0];
  assert.equal(innings?.wicketLimit, 5);
  assert.equal(innings?.wickets, 4, "a count above ten is not reset to zero");
  assert.equal(innings?.nonStriker, -1);
  assert.equal(innings?.order.length, 1);
  assert.equal(innings?.fow.length, 4);
  assert.equal(innings?.legalBalls, 150);
});

test("every dismissal of a returning batter is kept", () => {
  const clean = cleanMatch({
    innings: [
      soloInn("Arjun", "Ravi", {
        wickets: 12,
        wicketLimit: 12,
        fow: Array.from({ length: 12 }, (_, i) => `${i}/${i + 1} (Arjun, 0.${i + 1})`),
        batters: [
          { name: "Arjun", runs: 60, balls: 40, fours: 6, sixes: 2, out: null, dismissals: 12 },
        ],
      }),
    ],
    current: 0,
    target: null,
  });
  assert.equal(clean?.innings[0].wickets, 12);
  assert.equal(clean?.innings[0].fow.length, 12);
  assert.equal(clean?.innings[0].batters[0].dismissals, 12);
});

test("a long solo innings keeps its ball figures and event log", () => {
  const events = Array.from({ length: 700 }, (_, i) => ({
    id: i + 1,
    label: "1",
    detail: "1 run — Arjun",
    legal: true,
    runs: 1,
    wicket: null,
    striker: "Arjun",
    bowler: "Ravi",
    overText: `${Math.floor(i / 6)}.${(i % 6) + 1}`,
  }));
  const clean = cleanMatch({
    innings: [
      soloInn("Arjun", "Ravi", {
        legalBalls: 700,
        runs: 700,
        events,
        batters: [
          { name: "Arjun", runs: 700, balls: 700, fours: 70, sixes: 20, out: null },
        ],
        bowlers: [{ name: "Ravi", balls: 700, runs: 700, wickets: 4 }],
      }),
    ],
    current: 0,
    target: null,
    isTest: true,
  });
  const innings = clean?.innings[0];
  assert.equal(innings?.legalBalls, 700);
  assert.equal(innings?.events.length, 700, "the worm and the log stay whole");
  assert.equal(innings?.batters[0].balls, 700);
  assert.equal(innings?.bowlers[0].balls, 700);
});

test("cleanMatchEntry stores a 1 v 1 result", () => {
  const entry = cleanMatchEntry({
    format: "Test",
    venue: "Turf",
    scoreline: "Arjun 50/3 (20.0) · Ravi 40/3 (18.0)",
    result: "Ravi won by 2 wickets",
    innings: [
      soloInn("Arjun", "Ravi", { runs: 50, wickets: 3, done: true }),
      soloInn("Ravi", "Arjun", { runs: 41, wickets: 1, done: true }),
    ],
  });
  assert.equal(entry?.innings.length, 2);
  assert.equal(entry?.innings[0].wicketLimit, 5);
  assert.equal(entry?.result, "Ravi won by 2 wickets");
});
