import { NextResponse } from "next/server";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_TTL_SECONDS,
  OAUTH_VERIFIER_COOKIE,
  buildAuthUrl,
  googleConfigured,
  pkceChallenge,
  randomSecret,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only ever return to a path on this site; `//host` and `/\host` are rejected. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/**
 * Kick off the Google authorization-code flow. `state` (CSRF) and the PKCE
 * verifier live in HttpOnly cookies for the ten-minute round trip, together
 * with wherever the user was heading before they had to sign in.
 */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const state = randomSecret();
  const verifier = randomSecret(48);
  const next = safeNext(url.searchParams.get("next"));

  const response = NextResponse.redirect(
    buildAuthUrl({ state, codeChallenge: pkceChallenge(verifier) })
  );
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
  response.cookies.set(OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, options);
  response.cookies.set(OAUTH_NEXT_COOKIE, next, options);
  return response;
}