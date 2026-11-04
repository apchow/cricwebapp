import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hashPassword, normalizeEmail, startSession } from "@/lib/auth";
import { mutate } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@punditarena.app";

/**
 * One-tap access for anyone who wants to look before signing up. The account
 * lives on this machine with a random password, so it is reachable only
 * through this endpoint — and it is the *same* account for every visitor, so
 * anything a demo user saves is visible to the next one.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(request, {
    name: "demo-login",
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many demo sessions from this address. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const email = normalizeEmail(DEMO_EMAIL);

  const user = await mutate(async (db) => {
    const existing = db.users.find((candidate) => candidate.email === email);
    if (existing) return { id: existing.id, email: existing.email };

    const created = {
      id: randomUUID(),
      email,
      password: await hashPassword(randomUUID()),
      createdAt: new Date().toISOString(),
    };
    db.users.push(created);
    return { id: created.id, email: created.email };
  });

  await startSession(user);
  return NextResponse.json({ user });
}
