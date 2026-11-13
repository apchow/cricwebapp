import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { DEMO_EMAIL, hashPassword, normalizeEmail, startSession } from "@/lib/auth";
import { mutate } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-tap access for anyone who wants to look before signing up. It is the
 * *same* read-only account for every visitor: writeGate rejects every mutating
 * request it makes, so nobody can post to the wall or save matches the next
 * visitor would inherit. A random password means it is reachable only here.
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
