import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BANTER_MAX_CHARS,
  BANTER_WINDOW,
  authorLabel,
  cleanBanterText,
  displayPosts,
  gradientFor,
  handleFor,
  looksLikeLink,
  trimBanter,
} from "../src/lib/banter.ts";
import type { StoredBanter } from "../src/lib/store.ts";

function post(id: string, overrides: Partial<StoredBanter> = {}): StoredBanter {
  return {
    id,
    userId: `user-${id}`,
    author: `Fan ${id}`,
    text: `Take number ${id}`,
    createdAt: new Date(Date.UTC(2026, 10, 4, 10) + Number(id) * 60_000).toISOString(),
    likes: [],
    ...overrides,
  };
}

test("cleanBanterText accepts normal takes and rejects the rest", () => {
  assert.equal(cleanBanterText("  Back to a five-bowler attack.  "), "Back to a five-bowler attack.");
  assert.equal(cleanBanterText("ab"), null);
  assert.equal(cleanBanterText(""), null);
  assert.equal(cleanBanterText(null), null);
  assert.equal(cleanBanterText(42), null);
  assert.equal(cleanBanterText("x".repeat(BANTER_MAX_CHARS)), "x".repeat(BANTER_MAX_CHARS));
  assert.equal(cleanBanterText("x".repeat(BANTER_MAX_CHARS + 1)), null);
});

test("cleanBanterText collapses whitespace so length means visible characters", () => {
  // 502 raw characters collapse to "a b" — three visible characters, so it passes.
  assert.equal(cleanBanterText(`a${" ".repeat(500)}b`), "a b");
  assert.equal(cleanBanterText(`a${" ".repeat(500)}bc`), "a bc");
  // Run-on spaces cannot be used to smuggle past the cap.
  assert.equal(cleanBanterText(`${"x".repeat(240)}${" ".repeat(200)}y`), null);
});

test("looksLikeLink blocks links without blocking cricket talk", () => {
  for (const spam of [
    "check out https://tips.example.com for fixed matches",
    "best odds www.bet-site.in/daily",
    "dm me on cricket.tips@spam.com now",
    "join cricket-tips.xyz/whatsapp today",
  ]) {
    assert.equal(looksLikeLink(spam), true, spam);
  }
  for (const take of [
    "Kohli 100* off 88 is the innings of the series",
    "he bowled 2/41 in the death — plenty",
    "@bumrah should have kept that ball short",
    "52.4 vs 48.1 run rate, still a game",
  ]) {
    assert.equal(looksLikeLink(take), false, take);
  }
});

test("the wall keeps only the newest posts", () => {
  const many = Array.from({ length: 25 }, (_, index) => post(String(index)));
  const trimmed = trimBanter(many);
  assert.equal(trimmed.length, BANTER_WINDOW);
  assert.equal(trimmed[trimmed.length - 1].id, "24");
  assert.equal(trimmed[0].id, "15", "the oldest fifteen roll off");
});

test("a wall at or under the window is untouched", () => {
  const few = [post("1"), post("2")];
  assert.deepEqual(trimBanter(few), few);
});

test("displayPosts newest first, with shared like counts and ownership", () => {
  const viewer = { id: "user-2", email: "fan@example.com" };
  const posts = [
    post("1", { likes: ["user-2", "x"] }),
    post("2", { userId: "user-2", likes: [] }),
  ];
  const shown = displayPosts(posts, viewer);
  assert.deepEqual(
    shown.map((item) => item.id),
    ["2", "1"]
  );
  assert.equal(shown[0].own, true);
  assert.equal(shown[0].likes, 0);
  assert.equal(shown[1].likes, 2);
  assert.equal(shown[1].liked, true);
});

test("anonymous readers see the wall without ownership or likes", () => {
  const shown = displayPosts([post("1", { likes: ["a", "b", "c"] })], null);
  assert.equal(shown[0].own, false);
  assert.equal(shown[0].liked, false);
  assert.equal(shown[0].likes, 3);
});

test("identity is stable per user and drawn from a fixed gradient palette", () => {
  assert.equal(handleFor("abc"), handleFor("abc"));
  assert.notEqual(handleFor("abc"), handleFor("abd"));
  assert.match(gradientFor("abc"), /^from-[a-z]+-\d+ to-[a-z]+-\d+$/);
  assert.equal(gradientFor("abc"), gradientFor("abc"));
});

test("author labels come from the email and stay short", () => {
  assert.equal(authorLabel("cover_drive@example.com"), "Cover Drive");
  assert.equal(authorLabel("a".repeat(60) + "@example.com").length, 32);
  assert.equal(authorLabel("@example.com"), "Anon");
});
