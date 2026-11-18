import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_SERIES_ID,
  SERIES,
  rulesFor,
  seriesById,
  squadFor,
} from "../src/data/fixtures.ts";
import { TEST_EXTRA_PLAYERS } from "../src/data/test-extras.ts";
import { TEST_ROLE_PLAN, autoPickXI } from "../src/lib/autopick.ts";
import type { Player } from "../src/types/player.ts";

const db = JSON.parse(
  readFileSync(new URL("../public/data/players.json", import.meta.url), "utf8")
) as { players: Player[] };

const pool: Player[] = [...db.players, ...TEST_EXTRA_PLAYERS];
const byName = new Map(pool.map((player) => [player.name.toLowerCase(), player]));

const testSeries = seriesById("nz-ind-test-2026");

test("the Test series is the builder's default board", () => {
  assert.equal(SERIES[0].format, "Test");
  assert.equal(DEFAULT_SERIES_ID, testSeries.id);
  assert.equal(testSeries.fixtures.length, 2);
  assert.equal(testSeries.fixtures[0].venue, "Basin Reserve");
  assert.equal(testSeries.fixtures[1].venue, "Hagley Oval");
});

test("both Test squads resolve fully against the database", () => {
  for (const side of ["IND", "NZ"] as const) {
    const squad = squadFor(testSeries, side, 1);
    const missing = squad.players.filter((name) => !byName.has(name.toLowerCase()));
    assert.deepEqual(missing, [], `${side} missing rows`);
    assert.ok(squad.players.length >= 11);
  }
});

test("withdrawn players stay out of the Test pools", () => {
  const ind = squadFor(testSeries, "IND", 2).players;
  const nz = squadFor(testSeries, "NZ", 2).players;
  assert.ok(!ind.includes("Kuldeep Yadav"));
  assert.ok(!nz.includes("Mitchell Santner"));
  assert.ok(ind.includes("Gurnoor Brar"));
  assert.ok(nz.includes("Dean Foxcroft"));
});

test("Test rules keep the keeper and drop the ODI bowling ceiling", () => {
  const rules = rulesFor("Test");
  assert.equal(rules.size, 11);
  assert.equal(rules.minKeeper, 1);
  assert.equal(rules.minBowlingOptions, 5);
  assert.ok(rules.maxBowlingOptions >= 11);
  assert.equal(rulesFor("ODI").maxBowlingOptions, 7);
});

test("auto-pick fields a legal Test XI for both sides", () => {
  for (const side of ["IND", "NZ"] as const) {
    const squad = squadFor(testSeries, side, 1);
    const xi = autoPickXI(
      squad.players.map((name) => byName.get(name.toLowerCase())!) as Player[],
      { maxOverseas: 11, plan: TEST_ROLE_PLAN }
    );
    assert.equal(xi.players.length, 11, `${side} XI size`);
    assert.deepEqual(xi.unmet, [], `${side} unmet rules`);
    assert.ok(xi.composition["Wicket-Keeper"] >= 1);
    assert.ok(
      xi.composition.Bowler + xi.composition["All-Rounder"] >= 5,
      `${side} bowling options`
    );
  }
});

test("the ODI leg keeps its five fixtures and split squad windows", () => {
  const odi = seriesById("nz-ind-odi-2026");
  assert.equal(odi.format, "ODI");
  assert.equal(odi.fixtures.length, 5);
  assert.equal(odi.windows.length, 2);
  assert.deepEqual(odi.windows[0].fixtures, [1, 2, 3]);
  assert.deepEqual(odi.windows[1].fixtures, [4, 5]);
});