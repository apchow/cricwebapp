import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RESET_TTL_MS,
  hashResetToken,
  isResetExpired,
  newResetToken,
} from "../src/lib/reset-token.ts";
import { passwordResetHtml } from "../src/lib/email.ts";

test("a reset token is a 256-bit base64url secret with a sha-256 hash", () => {
  const now = Date.parse("2026-11-13T10:00:00Z");
  const { token, tokenHash, expiresAt } = newResetToken(now);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(tokenHash, hashResetToken(token));
  assert.equal(expiresAt, now + RESET_TTL_MS);
});

test("every reset token is unique and hashes deterministically", () => {
  const a = newResetToken();
  const b = newResetToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, b.tokenHash);
  assert.equal(hashResetToken(a.token), hashResetToken(a.token));
  assert.equal(hashResetToken(a.token), a.tokenHash);
});

test("the raw token is never the stored hash", () => {
  const { token, tokenHash } = newResetToken();
  assert.notEqual(token, tokenHash);
});

test("expiry is inclusive of the deadline instant", () => {
  const now = 1_000_000;
  assert.equal(isResetExpired(now - 1, now), true);
  assert.equal(isResetExpired(now, now), true);
  assert.equal(isResetExpired(now + 1, now), false);
});

test("the reset email carries the link and escapes HTML metacharacters", () => {
  const html = passwordResetHtml('https://x.test/reset?token=abc&y=<>"\'');
  assert.ok(html.includes("Reset your password"));
  assert.ok(html.includes("expires in one hour"));
  assert.ok(html.includes("&amp;"));
  assert.ok(html.includes("&lt;"));
  assert.ok(html.includes("&gt;"));
  assert.ok(html.includes("&quot;"));
  assert.ok(html.includes("&#39;"));
  // No raw angle bracket from the injected URL survives into the markup.
  assert.ok(!html.includes('<>"'));
});