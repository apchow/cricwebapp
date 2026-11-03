import { test } from "node:test";
import assert from "node:assert/strict";

import { autoPickXI } from "../src/lib/autopick.ts";
import type { Player, PlayerRole } from "../src/types/player.ts";

const ROLES: PlayerRole[] = [
  "Batter",
  "Bowler",
  "All-Rounder",
  "Wicket-Keeper",
];

let nextId = 1;

function mk(role: PlayerRole, country: string, form: number, basePrice = 100): Player {
  const id = nextId++;
  return {
    id,
    name: `${country} ${role} ${id}`,
    country,
    role,
    isActive: true,
    era: "current",
    team: "MI",
    basePrice,
    form,
    ppImpact: form,
    deathImpact: form,
    vfm: form,
    punditTag: "Solid",
    isUncapped: false,
  };
}

/** 40 players: overseas stars outrank the Indian squad in every role. */
function richPool(): Player[] {
  const list: Player[] = [];
  for (const role of ROLES) {
    for (let i = 0; i < 4; i++) list.push(mk(role, "AUS", 95 - i));
  }
  for (const role of ROLES) {
    for (let i = 0; i < 6; i++) list.push(mk(role, "IND", 70 - i));
  }
  return list;
}

test("autoPickXI fills a complete eleven from a rich pool", () => {
  const result = autoPickXI(richPool());
  assert.equal(result.players.length, 11);
  assert.deepEqual(result.unmet, []);
});

test("autoPickXI never exceeds the overseas cap, even when the best are overseas", () => {
  const result = autoPickXI(richPool());
  assert.equal(result.overseas, 4);
  assert.equal(
    result.players.filter((player) => player.country !== "IND").length,
    4
  );
});

test("autoPickXI respects a custom overseas limit", () => {
  const result = autoPickXI(richPool(), { maxOverseas: 2 });
  assert.equal(result.overseas, 2);
  assert.equal(result.players.length, 11);
});

test("autoPickXI always fields a keeper and five bowling options", () => {
  const result = autoPickXI(richPool());
  assert.equal(result.composition["Wicket-Keeper"], 1);
  assert.ok(result.composition.Bowler + result.composition["All-Rounder"] >= 5);
});

test("autoPickXI lays the XI out in batting order", () => {
  const result = autoPickXI(richPool());
  assert.equal(result.players[0].role, "Batter");
  assert.equal(result.players[1].role, "Batter");
  assert.equal(result.players.at(-1)?.role, "Bowler");
});

test("autoPickXI never selects the same player twice", () => {
  const result = autoPickXI(richPool());
  const ids = result.players.map((player) => player.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("autoPickXI reports unmet rules when the pool is too small", () => {
  const tiny = [
    mk("Wicket-Keeper", "IND", 60),
    mk("Bowler", "IND", 55),
    mk("Batter", "IND", 50),
  ];
  const result = autoPickXI(tiny);
  assert.equal(result.players.length, 3);
  assert.ok(result.unmet.includes("Only 3 players available"));
  assert.ok(result.unmet.includes("Fewer than 5 bowling options"));
});

test("autoPickXI does not mutate or duplicate the pool", () => {
  const pool = richPool();
  const size = pool.length;
  autoPickXI(pool, { maxOverseas: 8 });
  assert.equal(pool.length, size);
});

test("autoPickXI reports the combined base price of the XI", () => {
  const result = autoPickXI(richPool());
  assert.equal(
    result.spend,
    result.players.reduce((sum, player) => sum + player.basePrice, 0)
  );
});

test("autoPickXI keeps an auction XI inside the purse", () => {
  const pool: Player[] = [];
  for (const role of ROLES) pool.push(mk(role, "IND", 95, 400));
  for (const role of ROLES) {
    for (let i = 0; i < 5; i++) pool.push(mk(role, "IND", 40, 50));
  }
  const budget = 950;
  const result = autoPickXI(pool, { budget });
  assert.equal(result.players.length, 11);
  assert.ok(result.spend <= budget, `spend ${result.spend} over ${budget}`);
});

test("autoPickXI says so when the purse cannot fill an XI", () => {
  const pool: Player[] = [];
  for (const role of ROLES) {
    for (let i = 0; i < 5; i++) pool.push(mk(role, "IND", 70, 50));
  }
  const result = autoPickXI(pool, { budget: 200 });
  assert.equal(result.players.length, 4);
  assert.ok(
    result.unmet.some((line) => line.includes("purse")),
    result.unmet.join(" | ")
  );
});
