import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/api";
import { hashPassword, startSession, validPassword } from "@/lib/auth";
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { hashResetToken, isResetExpired } from "@/lib/reset-token";
import { mutate } from "@/lib/store";
import { text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESET_LIMIT: RateLimitOptions = {
  name: "reset",
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

const INVALID = {
  error: "This reset link is invalid or has expired. Request a new one.",
};

export async function POST(request: Request) {
  const attempt = await rateLimit(request, RESET_LIMIT);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
    );
  }

  const body = await jsonBody(request);
  const token = text(body?.token, 200);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "No reset token given" }, { status: 400 });
  }
  if (!validPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const tokenHash = hashResetToken(token);
  const result = await mutate(async (db) => {
    const now = Date.now();
    const reset = db.passwordResets.find(
      (item) => item.tokenHash === tokenHash && !isResetExpired(item.expiresAt, now)
    );
    if (!reset) return null;

    const user = db.users.find((item) => item.id === reset.userId);
    if (!user) return null;

    user.password = await hashPassword(password);
    // Single use: burn every link for this account, not just the one presented.
    db.passwordResets = db.passwordResets.filter((item) => item.userId !== user.id);
    return { id: user.id, email: user.email };
  });

  if (!result) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  await startSession(result);
  return NextResponse.json({ ok: true, user: result });
}