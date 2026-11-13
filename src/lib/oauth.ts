// Relative, extension-qualified: `node --test` loads the pure helpers below
// (buildAuthUrl, pkceChallenge, normaliseProfile) and cannot resolve "@/lib".
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./app-url.ts";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES = ["openid", "email", "profile"];

/** Short-lived cookies that carry the handshake across the Google round trip. */
export const OAUTH_STATE_COOKIE = "crichub_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "crichub_oauth_verifier";
export const OAUTH_NEXT_COOKIE = "crichub_oauth_next";
/** The consent round trip should never outlive ten minutes. */
export const OAUTH_TTL_SECONDS = 10 * 60;

/** Both halves of the client credential must exist before the button is useful. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Derived from `appUrl()` so it matches the environment exactly: the Vercel
 * production origin in prod, the dev origin locally. Google compares this
 * against the registered redirect URI byte-for-byte, so both must be listed in
 * the Cloud Console.
 */
export function googleRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

/** Opaque URL-safe random string, for `state` and the PKCE verifier. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** S256 PKCE: the challenge sent to Google, from the stored verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(input: { state: string; codeChallenge: string }): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface TokenResult {
  accessToken: string | null;
  error: string | null;
}

/** Server-only: the client secret never reaches the browser. */
export async function exchangeCode(code: string, verifier: string): Promise<TokenResult> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
  } catch {
    return { accessToken: null, error: "Google token exchange unreachable" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { accessToken: null, error: "Google returned an unreadable token response" };
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) {
    const desc = typeof payload.error_description === "string" ? payload.error_description : "";
    const err = typeof payload.error === "string" ? payload.error : `status ${response.status}`;
    return { accessToken: null, error: `Google rejected the code (${err}${desc ? `: ${desc}` : ""})` };
  }
  return { accessToken, error: null };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Pure so the mapping — the part that trusts Google's payload — can be tested. */
export function normaliseProfile(payload: Record<string, unknown>): GoogleProfile | null {
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const rawEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!sub || !rawEmail) return null;
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : rawEmail;
  return {
    sub,
    email: rawEmail.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name,
  };
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return normaliseProfile((await response.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}