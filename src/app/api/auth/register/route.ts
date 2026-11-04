import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonBody } from "@/lib/api";
import {
  hashPassword,
  normalizeEmail,
  startSession,
  validEmail,
  validPassword,
} from "@/lib/auth";
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A few sign-ups per IP per half hour covers a house or office, not a bot farm. */
const SIGNUP_LIMIT: RateLimitOptions = {
  name: "register",
  limit: 5,
  windowMs: 30 * 60 * 1000,
};

export async function POST(request: Request) {
  const attempt = await rateLimit(request, SIGNUP_LIMIT);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(attempt.retryAfterSeconds) },
      }
    );
  }

  const body = await jsonBody(request);
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  const password = typeof body?.password === "string" ? body.password : "";

  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!validPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const result = await mutate(async (db) => {
    if (db.users.some((user) => user.email === email)) {
      return { error: "That email is already registered" } as const;
    }
    const user = {
      id: randomUUID(),
      email,
      password: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return { user: { id: user.id, email: user.email } } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  await startSession(result.user);
  return NextResponse.json({ user: result.user }, { status: 201 });
}
