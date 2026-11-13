import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  autoPlan,
  evaluateSelection,
  type RetentionPlayer,
} from "../src/lib/retention/rules.ts";
import { RETENTION_RULES } from "../src/lib/retention/constants.ts";

type RawPlayer = Record<string, unknown>;
type RawTeam = { id: string; squad: RawPlayer[] };

const pool = JSON.parse(
  readFileSync(new URL("../src/data/ipl-squads.json", import.meta.url), "utf8")
) as { teams: RawTeam[] };

const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : fallback);

function toPlayer(p: RawPlayer): RetentionPlayer {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? "Unknown"),
    role: String(p.role ?? "BAT"),
    country: String(p.country ?? "India"),
    overseas: Boolean(p.overseas),
    uncapped: Boolean(p.uncapped),
    impact: num(p.impact),
    retentionValue: num(p.retentionValue, 4),
    iplMatches: num(p.matches),
    seasonMatches: num(p.seasonMatches),
    latestSeasonMatches: num(p.latestSeasonMatches),
    lastSeason: String(p.lastSeason ?? ""),
    runs: num(p.runs),
    balls: num(p.balls),
    strikeRate: (p.strikeRate as number | null) ?? null,
    wickets: num(p.wickets),
    economy: (p.economy as number | null) ?? null,
    seasonRuns: num(p.seasonRuns),
    seasonBalls: num(p.seasonBalls),
    seasonWickets: num(p.seasonWickets),
    seasonStrikeRate: (p.seasonStrikeRate as number | null) ?? null,
    seasonEconomy: (p.seasonEconomy as number | null) ?? null,
    lastPlayed: (p.lastPlayed as string | null) ?? null,
  };
}

function byId(players: RetentionPlayer[]) {
  return new Map(players.map((p) => [p.id, p]));
}

test("autoPlan yields a valid, complete selection for every real franchise", () => {
  assert.equal(pool.teams.length, 10, "the pool covers all ten franchises");
  for (const team of pool.teams) {
    const players = team.squad.map(toPlayer);
    const selection = autoPlan(players);
    const status = evaluateSelection(selection, byId(players));
    assert.deepEqual(
      status.errors,
      [],
      `${team.id}: ${status.errors.join(" | ")}`
    );
    assert.equal(status.retainedCount, RETENTION_RULES.maxRetained, `${team.id}: six retained`);
    assert.equal(status.uncappedRetainedCount, RETENTION_RULES.minUncapped, `${team.id}: two uncapped`);
    assert.ok(
      status.retentionSpendCr <= RETENTION_RULES.retentionCapCr,
      `${team.id}: spend ${status.retentionSpendCr} within cap`
    );
    assert.ok(status.complete, `${team.id}: selection is complete`);
  }
});

test("autoPlan never retains or RTMs the same player twice", () => {
  for (const team of pool.teams) {
    const players = team.squad.map(toPlayer);
    const { retained, rtm } = autoPlan(players);
    const ids = [...retained, ...rtm].map((s) => s.playerId);
    assert.equal(new Set(ids).size, ids.length, `${team.id}: no player appears twice`);
  }
});

/**
 * A squad built to break the old planner: three uncapped players outrank every
 * capped one, and the six best values blow straight through the cap. The plan
 * must still hold exactly two uncapped and land under the purse.
 */
test("autoPlan respects the uncapped ceiling and the cap under pressure", () => {
  const players: RetentionPlayer[] = [];
  const mk = (id: string, uncapped: boolean, value: number, overseas = false): RetentionPlayer => ({
    ...toPlayer({ id, name: id, role: "BAT", country: overseas ? "Australia" : "India" }),
    uncapped,
    overseas,
    retentionValue: value,
  });
  players.push(mk("u1", true, 18), mk("u2", true, 17), mk("u3", true, 16));
  for (let i = 0; i < 8; i += 1) players.push(mk(`c${i}`, false, 18 - i, i < 4));

  const selection = autoPlan(players);
  const status = evaluateSelection(selection, byId(players));
  assert.deepEqual(status.errors, [], status.errors.join(" | "));
  assert.equal(status.uncappedRetainedCount, 2, "a third uncapped is never retained");
  assert.ok(status.retentionSpendCr <= RETENTION_RULES.retentionCapCr);
  assert.ok(
    selection.retained.every((s) => s.priceCr >= RETENTION_RULES.minPriceCr),
    "no price falls below the floor"
  );
});

test("autoPlan is deterministic for the same squad", () => {
  const players = pool.teams[0].squad.map(toPlayer);
  assert.deepEqual(autoPlan(players), autoPlan(players));
});