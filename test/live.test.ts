import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DAILY_BUDGET,
  UPSTREAM_MIN_INTERVAL_MS,
  normaliseCricApi,
  shouldFetchUpstream,
  splitFeed,
} from "../src/lib/live.ts";

/** Verbatim-shaped row from api.cricapi.com/v1/currentMatches. */
const FINISHED = {
  id: "e743011d-9258-4036-ae9e-e205c96c917f",
  name: "Lumbini Lions vs Pokhara Avengers, 13th Match, Nepal Premier League 2026",
  matchType: "t20",
  status: "Lumbini Lions won by 8 wkts",
  venue: "Tribhuvan University International Cricket Ground, Kirtipur",
  date: "2026-11-03",
  dateTimeGMT: "2026-11-03T09:15:00Z",
  teams: ["Lumbini Lions", "Pokhara Avengers"],
  teamInfo: [
    { teamId: "1", name: "Lumbini Lions", shortname: null, imageUrl: "" },
    { teamId: "2", name: "Pokhara Avengers", shortname: null, imageUrl: "" },
  ],
  score: [
    { r: 97, w: 9, o: "20.0", inning: "Pokhara Avengers Inning 1" },
    { r: 98, w: 2, o: "11.4", inning: "Lumbini Lions Inning 1" },
  ],
  series_id: "7550",
  matchStarted: true,
  matchEnded: true,
};

const LIVE = {
  ...FINISHED,
  id: "live-1",
  status: "Lumbini Lions need 24 runs off 18 balls",
  matchEnded: false,
  score: [
    { r: 180, w: 6, o: "20.0", inning: "Pokhara Avengers Inning 1" },
    { r: 156, w: 7, o: "17.0", inning: "Lumbini Lions Inning 1" },
  ],
};

const UPCOMING = {
  id: "up-1",
  name: "India vs Australia, 1st Test",
  matchType: "Test",
  status: [],
  venue: "Perth",
  date: "2026-11-20",
  dateTimeGMT: "2026-11-20T04:00:00Z",
  teams: ["India", "Australia"],
  teamInfo: [
    { name: "India", shortname: "IND" },
    { name: "Australia", shortname: "AUS" },
  ],
  score: [],
  matchStarted: false,
  matchEnded: false,
};

const FINISHED_TEST = {
  id: "intl-1",
  name: "India vs New Zealand, 2nd Test",
  matchType: "Test",
  status: "India won by 8 wkts",
  venue: "Kolkata",
  date: "2026-11-02",
  dateTimeGMT: "2026-11-02T04:00:00Z",
  teams: ["India", "New Zealand"],
  teamInfo: [
    { name: "India", shortname: "IND" },
    { name: "New Zealand", shortname: "NZ" },
  ],
  score: [],
  matchStarted: true,
  matchEnded: true,
};

test("innings are matched to their side by name, not by position", () => {
  const [match] = normaliseCricApi({ status: "success", data: [FINISHED] });
  assert.equal(match.teams[0].name, "Lumbini Lions");
  assert.equal(match.teams[1].name, "Pokhara Avengers");
  // Lumbini batted second, so their score is the second row of `score`.
  assert.equal(match.teams[0].score, "98/2 (11.4)");
  assert.equal(match.teams[1].score, "97/9 (20.0)");
});

test("status is read from a sentence and short names are derived", () => {
  const [match] = normaliseCricApi({ data: [FINISHED] });
  assert.equal(match.status, "Lumbini Lions won by 8 wkts");
  assert.equal(match.teams[0].short, "LUM");
  assert.equal(match.teams[1].short, "POK");
  assert.equal(match.finished, true);
  assert.equal(match.live, false);
});

test("domestic matchTypes are not mistaken for internationals", () => {
  const [domestic] = normaliseCricApi({ data: [FINISHED] });
  const [international] = normaliseCricApi({ data: [UPCOMING] });
  assert.equal(domestic.international, false);
  assert.equal(international.international, true);
});

test("an array status and a missing start time still parse", () => {
  const [match] = normaliseCricApi({ data: [UPCOMING] });
  assert.equal(match.status, "");
  assert.equal(match.startsAt, "2026-11-20T04:00:00.000Z");
  assert.equal(match.teams[0].short, "IND");
});

test("payloads that are not match lists come back empty, never thrown", () => {
  assert.deepEqual(normaliseCricApi(null), []);
  assert.deepEqual(normaliseCricApi({}), []);
  assert.deepEqual(normaliseCricApi({ status: "failure", reason: "Invalid API Key" }), []);
  assert.deepEqual(normaliseCricApi({ data: "nope" }), []);
  assert.deepEqual(normaliseCricApi({ data: [{ id: "" }] }), []);
  assert.deepEqual(normaliseCricApi({ data: [null, 7] }), []);
});

test("a match with no teamInfo falls back to the teams array", () => {
  const [match] = normaliseCricApi({
    data: [{ id: "x", name: "A vs B", teams: ["Alpha", "Beta"], matchType: "t20" }],
  });
  assert.equal(match.teams.length, 2);
  assert.equal(match.teams[0].name, "Alpha");
  assert.equal(match.teams[0].score, undefined);
});

test("splitFeed keeps in-play matches and international results only", () => {
  const matches = normaliseCricApi({ data: [LIVE, UPCOMING, FINISHED, FINISHED_TEST] });
  const { live, recent } = splitFeed(matches);
  assert.deepEqual(live.map((m) => m.id), ["live-1"]);
  assert.deepEqual(
    recent.map((m) => m.id),
    ["intl-1"],
    "domestic league results are not internationals"
  );
});

test("recent results are newest first and capped at six", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    id: `t${index}`,
    name: `Series ${index}`,
    matchType: "ODI",
    teams: ["A", "B"],
    dateTimeGMT: new Date(
      Date.UTC(2026, 10, 20, 4) + index * 3_600_000
    ).toISOString(),
    matchStarted: true,
    matchEnded: true,
  }));
  const { recent } = splitFeed(normaliseCricApi({ data: rows }));
  assert.equal(recent.length, 6);
  assert.equal(recent[0].id, "t9");
});

test("shouldFetchUpstream serves cached polls instead of spending quota", () => {
  const now = Date.parse("2026-11-04T10:00:00Z");
  assert.deepEqual(
    shouldFetchUpstream({
      now,
      lastFetchedAt: now - 60_000,
      usedToday: 3,
      budget: DEFAULT_DAILY_BUDGET,
    }),
    { fetch: false, reason: "fresh" }
  );
  assert.deepEqual(
    shouldFetchUpstream({
      now,
      lastFetchedAt: now - UPSTREAM_MIN_INTERVAL_MS,
      usedToday: 3,
      budget: DEFAULT_DAILY_BUDGET,
    }),
    { fetch: true }
  );
  assert.deepEqual(
    shouldFetchUpstream({
      now,
      lastFetchedAt: null,
      usedToday: 3,
      budget: DEFAULT_DAILY_BUDGET,
    }),
    { fetch: true }
  );
});

test("shouldFetchUpstream stops when the daily budget is spent", () => {
  const now = Date.parse("2026-11-04T10:00:00Z");
  assert.deepEqual(
    shouldFetchUpstream({
      now,
      lastFetchedAt: now - UPSTREAM_MIN_INTERVAL_MS * 2,
      usedToday: 450,
      budget: 450,
    }),
    { fetch: false, reason: "budget" }
  );
});

test("the refresh interval keeps a 24/7 server inside a free tier", () => {
  const callsPerDay = Math.floor((24 * 60 * 60 * 1000) / UPSTREAM_MIN_INTERVAL_MS);
  assert.ok(
    callsPerDay <= DEFAULT_DAILY_BUDGET,
    `${callsPerDay} upstream calls/day exceeds the ${DEFAULT_DAILY_BUDGET} budget`
  );
});
