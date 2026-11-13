import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { startSession, validEmail } from "@/lib/auth";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  exchangeCode,
  fetchProfile,
  googleConfigured,
} from "@/lib/oauth";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only ever return to a path on this site. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/**
 * An OAuth-only account has no password. This placeholder is never a valid
 * scrypt string, so the password path can never authenticate it — sign-in is
 * Google-only.
 */
function oauthPassword(): string {
  return `oauth$${randomUUID()}`;
}

type Outcome =
  | { ok: true; id: string; email: string }
  | { ok: false; reason: string };

export async function GET(request: Request) {
  const store = await cookies();
  const url = new URL(request.url);

  // Every exit clears the short-lived handshake cookies.
  const finish = (target: string) => {
    store.delete(OAUTH_STATE_COOKIE);
    store.delete(OAUTH_VERIFIER_COOKIE);
    store.delete(OAUTH_NEXT_COOKIE);
    return NextResponse.redirect(new URL(target, request.url));
  };
  const back = (reason: string) => finish(`/login?reason=${reason}`);

  if (!googleConfigured()) return back("notready");
  if (url.searchParams.get("error")) return back("cancelled");

  const code = url.searchParams.get("code") ?? "";
  const stateParam = url.searchParams.get("state") ?? "";
  const stateCookie = store.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const verifier = store.get(OAUTH_VERIFIER_COOKIE)?.value ?? "";
  const next = safeNext(store.get(OAUTH_NEXT_COOKIE)?.value ?? null);

  if (!code) return back("nocode");
  // CSRF guard: the state that comes back must be the one we issued.
  if (!stateCookie || stateParam !== stateCookie) return back("state");
  if (!verifier) return back("state");

  const token = await exchangeCode(code, verifier);
  if (!token.accessToken) return back("exchange");

  const profile = await fetchProfile(token.accessToken);
  if (!profile || !validEmail(profile.email)) return back("profile");

  const outcome = await mutate<Outcome>((db) => {
    const now = new Date().toISOString();

    // Returning user: the provider subject is the authority.
    const identity = db.identities.find(
      (item) => item.provider === "google" && item.subject === profile.sub
    );
    if (identity) {
      const linked = db.users.find((user) => user.id === identity.userId);
      if (linked) return { ok: true, id: linked.id, email: linked.email };
      // Linked account was deleted — recreate and re-point, keeping no orphans.
      const revived = {
        id: randomUUID(),
        email: profile.email,
        password: oauthPassword(),
        createdAt: now,
      };
      db.users.push(revived);
      identity.userId = revived.id;
      identity.email = profile.email;
      return { ok: true, id: revived.id, email: revived.email };
    }

    const byEmail = db.users.find((user) => user.email === profile.email);
    if (byEmail) {
      // Merge into an existing account only when Google vouches the mailbox is
      // the user's; an unverified address must not be able to claim one.
      if (!profile.emailVerified) return { ok: false, reason: "unverified" };
      db.identities.push({
        id: randomUUID(),
        userId: byEmail.id,
        provider: "google",
        subject: profile.sub,
        email: profile.email,
        createdAt: now,
      });
      return { ok: true, id: byEmail.id, email: byEmail.email };
    }

    const created = {
      id: randomUUID(),
      email: profile.email,
      password: oauthPassword(),
      createdAt: now,
    };
    db.users.push(created);
    db.identities.push({
      id: randomUUID(),
      userId: created.id,
      provider: "google",
      subject: profile.sub,
      email: profile.email,
      createdAt: now,
    });
    return { ok: true, id: created.id, email: created.email };
  });

  if (!outcome.ok) return back(outcome.reason);

  await startSession({ id: outcome.id, email: outcome.email });
  return finish(next || "/");
}