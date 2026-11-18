import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AUCTION_RULES, setFor, type AuctionData, type OfficialTeam } from "../src/lib/auction/data.ts";
import {
  customPlan,
  officialPlan,
  rosterFor,
  suggestCustom,
  clampPrice,
} from "../src/lib/auction/plan.ts";
import { AuctionEngine, archetypeFor, formValueCr, nextBidCr } from "../src/lib/auction/engine.ts";

const raw = JSON.parse(
  readFileSync(new URL("../src/data/ipl-2027-retentions.json", import.meta.url), "utf8")
) as AuctionData;

const teams: OfficialTeam[] = raw.teams.map((t) => ({
  ...t,
  name: t.id.toUpperCase(),
  short: t.id.toUpperCase(),
  color: "#ffffff",
  ink: "#000000",
}));

const team = (id: string) => teams.find((t) => t.id === id)!;

function poolFor(userTeamId: string, retainedIds: Set<string>) {
  const kept = new Set(retainedIds);
  for (const t of teams) {
    if (t.id === userTeamId) continue;
    for (const p of t.retained) kept.add(p.id);
  }
  const all = new Map<string, (typeof teams)[number]["retained"][number]>();
  for (const t of teams) for (const p of [...t.retained, ...t.released]) all.set(p.id, p);
  return [...all.values()].filter((p) => !kept.has(p.id));
}

function runToEnd(engine: AuctionEngine, autoBid = false): void {
  let guard = 0;
  while (engine.phase === "live" && guard < 40000) {
    if (autoBid && engine.canUserBid()) engine.userBid();
    engine.tick(250);
    guard += 1;
  }
  assert.equal(engine.phase, "done", "auction must terminate");
}

function assertInvariants(engine: AuctionEngine): void {
  for (const t of engine.teams) {
    assert.ok(t.purseCr >= -1e-9, `${t.id} purse negative: ${t.purseCr}`);
    assert.ok(t.slots >= 0, `${t.id} slots negative`);
    assert.ok(t.overseasSlots >= 0, `${t.id} overseas slots negative`);
    const squadSize = t.retained.length + t.buys.length;
    assert.ok(squadSize <= AUCTION_RULES.maxSquad, `${t.id} squad over 25`);
    const overseas = [...t.retained, ...t.buys.map((b) => b.player)].filter((p) => p.overseas).length;
    assert.ok(overseas <= AUCTION_RULES.maxOverseas, `${t.id} over 8 overseas`);
    for (const b of t.buys) {
      assert.ok(b.priceCr >= b.player.basePriceCr - 1e-9, "sold below base");
    }
  }
}

test("official dataset reconciles with published slots and purses", () => {
  assert.equal(teams.length, 10);
  let purse = 0;
  const ids = new Set<string>();
  for (const t of teams) {
    assert.equal(t.retained.length, 25 - t.slots, `${t.id} retained vs slots`);
    assert.equal(
      t.retained.filter((p) => p.overseas).length,
      8 - t.overseasSlots,
      `${t.id} overseas vs slots`
    );
    purse += t.purseCr;
    for (const p of [...t.retained, ...t.released]) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
      assert.ok(p.basePriceCr >= 0.2, `${p.name} base below 0.2`);
      assert.ok(p.valueCr > 0, `${p.name} no value`);
    }
  }
  assert.ok(Math.abs(purse - 297.95) < 0.01, `combined purse ${purse}`);
  const released = teams.reduce((s, t) => s + t.released.length, 0);
  assert.equal(released, 90);
});

test("bid ladder follows IPL increments", () => {
  assert.equal(nextBidCr(0.2), 0.4);
  assert.equal(nextBidCr(0.8), 1);
  assert.equal(nextBidCr(1), 1.25);
  assert.equal(nextBidCr(4.75), 5);
  assert.equal(nextBidCr(5), 5.5);
  assert.equal(nextBidCr(9.5), 10);
  assert.equal(nextBidCr(10), 11);
});

test("sets partition the pool sensibly", () => {
  const pool = poolFor("csk", new Set(team("csk").retained.map((p) => p.id)));
  assert.equal(pool.length, 90);
  const marquee = pool.filter((p) => setFor(p) === "Marquee");
  assert.ok(marquee.length >= 8, "enough marquee names");
  assert.ok(marquee.every((p) => !p.uncapped && p.valueCr >= 5));
  assert.ok(pool.filter((p) => setFor(p) === "Uncapped").every((p) => p.uncapped));
});

test("official plan mirrors the announced purse and slots", () => {
  for (const t of teams) {
    const plan = officialPlan(t);
    assert.equal(plan.purseCr, t.purseCr);
    assert.equal(plan.slots, t.slots);
    assert.equal(plan.overseasSlots, t.overseasSlots);
    assert.equal(plan.spendCr, Math.round((120 - t.purseCr) * 100) / 100);
    assert.ok(plan.valid);
  }
});

test("custom plan computes purse, slots and overseas slots", () => {
  const csk = team("csk");
  const roster = rosterFor(csk);
  const picks = roster.slice(0, 5).map((p) => ({ playerId: p.id, priceCr: 8 }));
  const plan = customPlan(csk, picks);
  assert.equal(plan.spendCr, 40);
  assert.equal(plan.purseCr, 80);
  assert.equal(plan.slots, 20);
  assert.equal(plan.overseasSlots, 8 - picks.filter((p) => roster.find((r) => r.id === p.playerId)!.overseas).length);
  assert.ok(plan.valid);
});

test("custom plan rejects cap, overseas and empty violations", () => {
  const csk = team("csk");
  const roster = rosterFor(csk);
  const tooDear = customPlan(csk, roster.slice(0, 10).map((p) => ({ playerId: p.id, priceCr: 15 })));
  assert.ok(!tooDear.valid);
  assert.ok(tooDear.errors.some((e) => e.includes("salary cap")));

  const overseas = roster.filter((p) => p.overseas).slice(0, 9);
  const tooMany = customPlan(csk, overseas.map((p) => ({ playerId: p.id, priceCr: 1 })));
  assert.ok(!tooMany.valid);
  assert.ok(tooMany.errors.some((e) => e.includes("overseas")));

  assert.ok(!customPlan(csk, []).valid);

  const broke = customPlan(csk, roster.slice(0, 24).map((p) => ({ playerId: p.id, priceCr: 5 })));
  assert.ok(!broke.valid);
  assert.ok(broke.errors.some((e) => e.includes("minimum base")));

  assert.equal(clampPrice(0.01), 0.2);
  assert.equal(clampPrice(99), 25);
});

test("suggested custom plans are valid for every franchise", () => {
  for (const t of teams) {
    const plan = customPlan(t, suggestCustom(t));
    assert.ok(plan.valid, `${t.id}: ${plan.errors.join("; ")}`);
    assert.ok(plan.retained.length >= 10, `${t.id} too few retentions`);
  }
});

test("full auction terminates with all invariants for every user team", () => {
  for (const t of teams) {
    const plan = officialPlan(t);
    const engine = new AuctionEngine({
      userTeamId: t.id,
      plan,
      teams,
      pool: poolFor(t.id, new Set(plan.retained.map((p) => p.id))),
      seed: 42,
    });
    runToEnd(engine);
    assertInvariants(engine);
    assert.equal(engine.soldCount + engine.unsoldCount, engine.pool.length);
    const verdict = engine.rateUserSquad();
    assert.ok(verdict.score >= 5 && verdict.score <= 99);
  }
});

test("same seed produces the same auction", () => {
  const mk = () => {
    const plan = officialPlan(team("mi"));
    return new AuctionEngine({
      userTeamId: "mi",
      plan,
      teams,
      pool: poolFor("mi", new Set(plan.retained.map((p) => p.id))),
      seed: 7,
    });
  };
  const a = mk();
  const b = mk();
  runToEnd(a);
  runToEnd(b);
  assert.equal(a.soldCount, b.soldCount);
  assert.equal(a.totalSpendCr, b.totalSpendCr);
  assert.deepEqual(
    a.teams.map((t) => t.buys.map((x) => `${x.player.id}@${x.priceCr}`)),
    b.teams.map((t) => t.buys.map((x) => `${x.player.id}@${x.priceCr}`))
  );
});

test("user bidding, passing and purse reserve behave", () => {
  const plan = officialPlan(team("csk"));
  const engine = new AuctionEngine({
    userTeamId: "csk",
    plan,
    teams,
    pool: poolFor("csk", new Set(plan.retained.map((p) => p.id))),
    seed: 3,
  });
  assert.ok(engine.canUserBid(), "user can open at base");
  assert.ok(engine.userBid());
  assert.equal(engine.lot.leaderId, "csk");
  assert.ok(engine.lot.bidCr >= engine.lot.player.basePriceCr);
  assert.ok(!engine.canUserBid(), "cannot outbid yourself");
  engine.userPass();
  assert.ok(!engine.canUserBid(), "passed user stays out of the lot");
  runToEnd(engine, true);
  assertInvariants(engine);
  assert.ok(engine.user().buys.length >= 1, "auto-bidding user wins at least one lot");
  assert.ok(engine.userMaxBidCr() <= engine.user().purseCr);
});

test("no overseas slots means no overseas bids", () => {
  const csk = team("csk");
  const eightOverseas = rosterFor(csk).filter((p) => p.overseas).slice(0, 8);
  const plan = customPlan(csk, eightOverseas.map((p) => ({ playerId: p.id, priceCr: 1 })));
  assert.ok(plan.valid);
  assert.equal(plan.overseasSlots, 0);
  const engine = new AuctionEngine({
    userTeamId: "csk",
    plan,
    teams,
    pool: poolFor("csk", new Set(plan.retained.map((p) => p.id))),
    seed: 11,
  });
  let guard = 0;
  while (engine.phase === "live" && guard < 40000) {
    if (engine.lot.player.overseas && (engine.lot.phase === "open" || engine.lot.phase === "countdown")) {
      assert.ok(!engine.canUserBid(), "overseas lot must be locked");
    }
    engine.tick(250);
    guard += 1;
  }
  assertInvariants(engine);
});

test("custom retentions reshape the pool and the user purse", () => {
  const csk = team("csk");
  // Release a retained star and keep a released one instead.
  const releasedStar = csk.released.find((p) => p.name === "Matt Henry")!;
  const keptIds = csk.retained.slice(1).map((p) => p.id).concat(releasedStar.id);
  const plan = customPlan(csk, keptIds.map((id) => ({ playerId: id, priceCr: 4 })));
  assert.ok(plan.valid);
  const pool = poolFor("csk", new Set(keptIds));
  assert.ok(pool.some((p) => p.id === csk.retained[0].id), "released star joins the pool");
  assert.ok(!pool.some((p) => p.id === releasedStar.id), "custom keep leaves the pool");
  const engine = new AuctionEngine({ userTeamId: "csk", plan, teams, pool, seed: 5 });
  assert.equal(engine.user().purseCr, plan.purseCr);
  assert.equal(engine.user().slots, plan.slots);
  runToEnd(engine);
  assertInvariants(engine);
});

test("finishNow resolves the remainder without the user", () => {
  const plan = officialPlan(team("gt"));
  const engine = new AuctionEngine({
    userTeamId: "gt",
    plan,
    teams,
    pool: poolFor("gt", new Set(plan.retained.map((p) => p.id))),
    seed: 9,
  });
  engine.tick(250);
  engine.finishNow();
  assert.equal(engine.phase, "done");
  assertInvariants(engine);
  assert.equal(engine.user().buys.length, 0);
});
test("formValueCr rewards recent form and IPL trends, discounts rust", () => {
  const base = poolFor("mi", new Set())[0];
  const mk = (over: Partial<typeof base>) => ({ ...base, ...over });
  const hotBat = mk({ role: "BAT", valueCr: 5, seasonBalls: 200, seasonRuns: 320, seasonStrikeRate: 160, latestSeasonMatches: 12, uncapped: false, overseas: false });
  const coldBat = mk({ role: "BAT", valueCr: 5, seasonBalls: 200, seasonRuns: 120, seasonStrikeRate: 100, latestSeasonMatches: 12, uncapped: false, overseas: false });
  assert.ok(formValueCr(hotBat) > formValueCr(coldBat), "in-form bat outvalues out-of-form bat");
  const rusty = mk({ role: "BAT", valueCr: 5, latestSeasonMatches: 0, seasonBalls: 0, seasonRuns: 0, uncapped: false, overseas: false });
  assert.ok(formValueCr(rusty) < 5, "did-not-feature discounts below market anchor");
  const hype = mk({ role: "BAT", valueCr: 2, uncapped: true, impact: 70, latestSeasonMatches: 10, seasonBalls: 100, seasonRuns: 200, seasonStrikeRate: 150 });
  assert.ok(formValueCr(hype) > 2, "uncapped frenzy premiums above anchor");
});

test("stingy rivals spend less than free-spending on the same seed", () => {
  const plan = officialPlan(team("csk"));
  const pool = poolFor("csk", new Set(plan.retained.map((p) => p.id)));
  const spendFor = (mindset: "free" | "realistic" | "stingy") => {
    const e = new AuctionEngine({ userTeamId: "csk", plan, teams, pool, seed: 42, mindset });
    runToEnd(e);
    assertInvariants(e);
    return e.teams.filter((t) => !t.isUser).reduce((s, t) => s + t.spentCr, 0);
  };
  const free = spendFor("free");
  const realistic = spendFor("realistic");
  const stingy = spendFor("stingy");
  assert.ok(stingy < realistic, `stingy ${stingy} < realistic ${realistic}`);
  assert.ok(realistic < free, `realistic ${realistic} < free ${free}`);
});

test("mindset is live-adjustable and preserves invariants", () => {
  const plan = officialPlan(team("rr"));
  const e = new AuctionEngine({ userTeamId: "rr", plan, teams, pool: poolFor("rr", new Set(plan.retained.map((p) => p.id))), seed: 7, mindset: "free" });
  for (let i = 0; i < 40; i += 1) e.tick(250);
  e.mindset = "stingy";
  runToEnd(e);
  assertInvariants(e);
  assert.equal(e.mindset, "stingy");
});

test("auction opens with the marquee set and announces set changes", () => {
  const plan = officialPlan(team("mi"));
  const e = new AuctionEngine({ userTeamId: "mi", plan, teams, pool: poolFor("mi", new Set(plan.retained.map((p) => p.id))), seed: 4 });
  assert.equal(e.lot.set, "Marquee");
  assert.ok(e.pool.slice(0, 8).every((p) => setFor(p) === "Marquee"), "marquee lots come first");
  let guard = 0;
  while (e.lot.set === "Marquee" && e.phase === "live" && guard < 20000) {
    e.tick(250);
    guard += 1;
  }
  assert.ok(e.log.some((l) => l.text.includes("set begins")), "set transitions are logged");
});

test("tiered valuation: flexible per-bot caps, cheap backups, marquee inflation", () => {
  const plan = officialPlan(team("csk"));
  const e = new AuctionEngine({ userTeamId: "csk", plan, teams, pool: poolFor("csk", new Set(plan.retained.map((p) => p.id))), seed: 42, mindset: "realistic" });
  runToEnd(e);
  assertInvariants(e);
  const buys = e.teams.flatMap((t) => t.buys);
  for (const b of buys) {
    const arch = archetypeFor(b.player);
    if (arch.ceiling != null) {
      assert.ok(b.priceCr <= arch.ceiling + 1e-9, `${b.player.name} (${arch.name}) over tier ceiling: ${b.priceCr}`);
    }
  }
  assert.ok(e.unsoldCount > 0, "some low-impact names must go unsold");
  const stars = buys.filter((b) => b.player.valueCr >= 5);
  assert.ok(stars.length > 0, "marquee names still sell");
  assert.ok(buys.some((b) => b.priceCr > 5), "scarce marquee names inflate past 5cr");
  const backupSales = buys.filter((b) => archetypeFor(b.player).name === "Squad backup");
  assert.ok(backupSales.every((b) => b.priceCr <= 1.5 + 1e-9), "backups stay near base");
});
