import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildAuthUrl,
  googleConfigured,
  googleRedirectUri,
  normaliseProfile,
  pkceChallenge,
  randomSecret,
} from "../src/lib/oauth.ts";

/** Run a body with an isolated Google env, then restore it. */
function withEnv(values: Record<string, string | undefined>, body: () => void): void {
  const saved = { ...process.env };
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    body();
  } finally {
    process.env = saved;
  }
}

test("googleConfigured needs both halves of the credential", () => {
  withEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined }, () => {
    assert.equal(googleConfigured(), false);
  });
  withEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: undefined }, () => {
    assert.equal(googleConfigured(), false);
  });
  withEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }, () => {
    assert.equal(googleConfigured(), true);
  });
});

test("the redirect URI is the callback path on the current origin", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://arena.test" }, () => {
    assert.equal(googleRedirectUri(), "https://arena.test/api/auth/google/callback");
  });
});

test("randomSecret is URL-safe and sized to the requested entropy", () => {
  assert.match(randomSecret(32), /^[A-Za-z0-9_-]{43}$/);
  assert.match(randomSecret(48), /^[A-Za-z0-9_-]{64}$/);
  assert.notEqual(randomSecret(), randomSecret());
});

test("the PKCE challenge is the S256 base64url of the verifier", () => {
  const verifier = "test-verifier-value";
  const expected = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(pkceChallenge(verifier), expected);
  assert.match(pkceChallenge(verifier), /^[A-Za-z0-9_-]{43}$/);
});

test("buildAuthUrl carries the public flow params and never the secret", () => {
  withEnv(
    { GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "topsecret", NEXT_PUBLIC_APP_URL: "https://arena.test" },
    () => {
      const url = new URL(
        buildAuthUrl({ state: "xyz", codeChallenge: "chal" })
      );
      assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
      assert.equal(url.searchParams.get("client_id"), "cid.apps.googleusercontent.com");
      assert.equal(url.searchParams.get("redirect_uri"), "https://arena.test/api/auth/google/callback");
      assert.equal(url.searchParams.get("response_type"), "code");
      assert.equal(url.searchParams.get("scope"), "openid email profile");
      assert.equal(url.searchParams.get("state"), "xyz");
      assert.equal(url.searchParams.get("code_challenge"), "chal");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.ok(url.searchParams.get("prompt"));
      // The secret must never appear anywhere in the browser-facing URL.
      assert.ok(!url.toString().includes("topsecret"));
    }
  );
});

test("normaliseProfile lowercases email, honours verification, falls back to email for name", () => {
  const ok = normaliseProfile({
    sub: "google-123",
    email: "  Ada@Example.COM ",
    name: "Ada",
    email_verified: true,
  });
  assert.deepEqual(ok, { sub: "google-123", email: "ada@example.com", emailVerified: true, name: "Ada" });

  const noName = normaliseProfile({ sub: "s", email: "x@y.z", email_verified: false });
  assert.equal(noName?.name, "x@y.z");
  assert.equal(noName?.emailVerified, false);
});

test("normaliseProfile rejects a payload with no subject or email", () => {
  assert.equal(normaliseProfile({ email: "a@b.co" }), null);
  assert.equal(normaliseProfile({ sub: "s" }), null);
  assert.equal(normaliseProfile({}), null);
});