import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/api";
import {
  normalizeEmail,
  startSession,
  validEmail,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { query } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loose enough for a shared NAT household, tight enough to blunt brute force. */
const ATTEMPT_LIMIT: RateLimitOptions = {
  name: "login",
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

export async function POST(request: Request) {
  const attempt = await rateLimit(request, ATTEMPT_LIMIT);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(attempt.retryAfterSeconds) },
      }
    );
  }

  const body = await jsonBody(request);
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";

  if (!validEmail(email) || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await query(async (db) => {
    const found = db.users.find((candidate) => candidate.email === email);
    if (!found) return null;
    return (await verifyPassword(password, found.password))
      ? { id: found.id, email: found.email }
      : null;
  });

  if (!user) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  await startSession(user);
  return NextResponse.json({ user });
}
