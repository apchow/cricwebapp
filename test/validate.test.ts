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
});
