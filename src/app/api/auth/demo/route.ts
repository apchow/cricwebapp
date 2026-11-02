import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hashPassword, normalizeEmail, startSession } from "@/lib/auth";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@crichub.app";

/**
 * One-tap access for anyone who wants to look before signing up. The account
 * lives on this machine with a random password, so it is reachable only
 * through this endpoint.
 */
export async function POST() {
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
