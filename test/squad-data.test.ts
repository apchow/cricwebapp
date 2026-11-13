import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type SquadPlayer = {
  id: string;
  name: string;
  matches: number;
  runs: number;
  wickets: number;
  seasonMatches: number;
};

const pool = JSON.parse(
  readFileSync(new URL("../src/data/ipl-squads.json", import.meta.url), "utf8")
) as { season: string; teams: { id: string; squad: SquadPlayer[] }[] };
const db = JSON.parse(
  readFileSync(new URL("../public/data/players.json", import.meta.url), "utf8")
) as {
  players: { name: string; country: string; team: string; isActive: boolean }[];
};

const squad = pool.teams.flatMap((t) =>
  t.squad.map((p) => ({ ...p, team: t.id.toUpperCase() }))
);
const names = () => squad.map((p) => p.name);

/**
 * The squad files are data, so nothing here checks a computation — it checks
 * the invariants a regeneration is easiest to break. Reading the wrong key for
 * dismissals once shipped every bowler in the app with zero wickets.
 */
test("no bowler is listed with zero career wickets across the whole pool", () => {
  const wickets = squad.reduce((total, p) => total + p.wickets, 0);
  assert.ok(wickets > 3000, `pool holds ${wickets} career wickets`);
  const bumrah = squad.find((p) => p.name === "Jasprit Bumrah");
  assert.ok((bumrah?.wickets ?? 0) > 100, "the leading wicket-taker still has wickets");
});

test("the pool holds one entry per player, wherever they played", () => {
  const ids = squad.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "no player id appears twice");
  assert.equal(new Set(names()).size, ids.length, "no name appears twice");
});

test("scorebook initials are expanded to the name a squad page prints", () => {
  for (const name of ["Ruturaj Gaikwad", "Suryakumar Yadav", "Sarfaraz Khan", "Mukul Choudhary"]) {
    assert.ok(names().includes(name), `${name} is listed by name`);
  }
  assert.ok(!names().includes("S N Khan"), "Sarfaraz Khan is not hidden behind his initials");
  assert.ok(!names().includes("Shadab Khan"), "the Pakistan all-rounder is not in an IPL pool");
});

test("a Pakistan player never holds an IPL franchise", () => {
  const offenders = db.players.filter((p) => p.country === "PAK" && p.team !== "FREE AGENT");
  assert.deepEqual(offenders.map((p) => `${p.name}@${p.team}`), []);
});

test("the database and the pool agree on every shared name", () => {
  const byName = new Map(squad.map((p) => [p.name, p.team]));
  const drift = db.players
    .filter((p) => byName.has(p.name) && p.team !== "FREE AGENT" && byName.get(p.name) !== p.team)
    .map((p) => `${p.name}: database ${p.team}, pool ${byName.get(p.name)}`);
  assert.deepEqual(drift, []);
});

test("season figures are stored apart from career figures", () => {
  const played = squad.filter((p) => p.seasonMatches > 0);
  assert.ok(played.length > 150, `${played.length} players have a season on file`);
  for (const p of played) {
    assert.ok(p.seasonMatches <= p.matches, `${p.name}: season games within career games`);
  }
  assert.equal(pool.season, "2026");
});

test("the CSK all-rounder is Jamie Overton, not Craig", () => {
  assert.equal(squad.find((p) => p.id === "59559bc2")?.name, "Jamie Overton");
  const row = db.players.find((p) => p.name === "Jamie Overton");
  assert.ok(row, "Jamie Overton is in the database");
  assert.equal(row?.team, "CSK");
  assert.ok(!names().includes("Craig Overton"), "Craig Overton has no IPL deliveries");
  assert.ok(!db.players.some((p) => p.name === "Craig Overton"));
});

test("the display-name map cannot flip a name back on the next run", () => {
  const source = readFileSync(
    new URL("../scripts/sync-ipl-squads.mjs", import.meta.url),
    "utf8"
  );
  const block = source.match(/const DISPLAY = \{([\s\S]*?)\n\};/);
  assert.ok(block, "the DISPLAY map is present in the sync script");
  const display = new Function(`return {${block![1]}};`)() as Record<string, string>;
  const keys = new Set(Object.keys(display));
  const cycles = Object.values(display).filter((value) => keys.has(value));
  assert.deepEqual(cycles, [], "no display name is itself a scorebook key");
  assert.equal(display["J Overton"], "Jamie Overton");
  assert.equal(display["Thangarasu Natarajan"], "T Natarajan");
  assert.ok(!keys.has("T Natarajan"), "T Natarajan is canonical, not a key");
});
