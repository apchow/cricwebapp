import { test } from "node:test";
import assert from "node:assert/strict";

import { normaliseCricApi, splitFeed } from "../src/lib/live.ts";

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

const LIVE_MATCH = {
  id: "m1",
  name: "India vs Australia, 3rd T20I",
  type: "T20I",
  venue: "Rajkot",
  teams: ["India", "Australia"],
  teamInfo: [
    { name: "India", shortname: "IND" },
    { name: "Australia", shortname: "AUS" },
  ],
  status: ["India need 12 runs off 8 balls"],
  score: [
    { inns: 1, runs: 180, wickets: 6, overs: "20.0", team: "Australia" },
    { inns: 2, runs: 169, wickets: 8, overs: "18.4", team: "India" },
  ],
  matchStarted: true,
  matchEnded: false,
  startTimeUtc: inMinutes(-120),
};

const UPCOMING_MATCH = {
  id: "m2",
  name: "England vs New Zealand, 1st Test",
  type: "Test",
  venue: "Lord's",
  teams: ["England", "New Zealand"],
  teamInfo: [
    { name: "England", shortname: "ENG" },
    { name: "New Zealand", shortname: "NZ" },
  ],
  status: [],
  score: [],
  matchStarted: false,
  matchEnded: false,
  startTimeUtc: inMinutes(180),
};

const DOMESTIC_UPCOMING = {
  id: "m3",
  name: "Mumbai vs Chennai",
  type: "IPL",
  venue: "Wankhede",
  teams: ["Mumbai", "Chennai"],
  matchStarted: false,
  matchEnded: false,
  startTimeUtc: inMinutes(60),
};

test("normaliseCricApi reads scores, status and flags from a live match", () => {
  const [match] = normaliseCricApi({ data: [LIVE_MATCH] });
  assert.equal(match.id, "m1");
  assert.equal(match.live, true);
  assert.equal(match.international, true);
  assert.equal(match.status, "India need 12 runs off 8 balls");
  assert.equal(match.teams[0].short, "IND");
  assert.match(match.teams[0].score ?? "", /180\/6/);
  assert.match(match.teams[1].score ?? "", /169\/8/);
});

test("normaliseCricApi survives the payloads CricAPI actually sends", () => {
  assert.deepEqual(normaliseCricApi(null), []);
  assert.deepEqual(normaliseCricApi({}), []);
  assert.deepEqual(normaliseCricApi({ data: "nope" }), []);
  assert.deepEqual(normaliseCricApi({ data: [{ id: "" }] }), []);

  // No teamInfo, no score, unparseable start time.
  const [bare] = normaliseCricApi({
    data: [{ id: "x", teams: ["A", "B"], startTimeUtc: "", type: "ODI" }],
  });
  assert.equal(bare.teams.length, 2);
  assert.equal(bare.teams[0].name, "A");
  assert.equal(bare.teams[0].score, undefined);
  assert.equal(bare.startsAt, null);
  assert.equal(bare.international, true);
});

test("splitFeed separates in-play matches from upcoming internationals", () => {
  const matches = normaliseCricApi({
    data: [LIVE_MATCH, UPCOMING_MATCH, DOMESTIC_UPCOMING],
  });
  const { live, upcoming } = splitFeed(matches);
  assert.deepEqual(
    live.map((match) => match.id),
    ["m1"]
  );
  assert.deepEqual(
    upcoming.map((match) => match.id),
    ["m2"],
    "domestic fixtures are not internationals"
  );
});

test("splitFeed orders upcoming fixtures soonest first and caps the list", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: `t${index}`,
    name: `Series ${index}`,
    type: "T20I",
    teams: ["A", "B"],
    matchStarted: false,
    matchEnded: false,
    startTimeUtc: inMinutes(600 - index * 30),
  }));
  const { upcoming } = splitFeed(normaliseCricApi({ data: rows }));
  assert.equal(upcoming.length, 8);
  assert.equal(upcoming[0].id, "t11");
  assert.ok(
    upcoming.every((match, index, list) =>
      index === 0 ? true : Date.parse(match.startsAt!) >= Date.parse(list[index - 1].startsAt!)
    )
  );
});

test("splitFeed drops finished matches from the upcoming list", () => {
  const matches = normaliseCricApi({
    data: [{ ...UPCOMING_MATCH, matchStarted: true, matchEnded: true }],
  });
  const { live, upcoming } = splitFeed(matches);
  assert.equal(live.length, 0);
  assert.equal(upcoming.length, 0);
});
