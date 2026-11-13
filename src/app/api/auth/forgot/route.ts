import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/api";
import { isDemoEmail, normalizeEmail, validEmail } from "@/lib/auth";
import { emailEnabled, sendPasswordReset } from "@/lib/email";
import { rateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import { newResetToken } from "@/lib/reset-token";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A handful of reset requests per IP per quarter hour, not a mail bomber. */
const FORGOT_LIMIT: RateLimitOptions = {
  name: "forgot",
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

/** Same answer whether or not the address is registered, so it cannot be mined. */
const GENERIC = {
  ok: true,
  message:
    "If an account exists for that email, a reset link is on its way. It expires in one hour.",
};

export async function POST(request: Request) {
  const attempt = await rateLimit(request, FORGOT_LIMIT);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
    );
  }

  if (!emailEnabled()) {
    return NextResponse.json(
      { error: "Password reset email is not available yet." },
      { status: 503 }
    );
  }

  const body = await jsonBody(request);
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  // The shared demo account is read-only and must never be locked out.
  if (isDemoEmail(email)) {
    return NextResponse.json(GENERIC);
  }

  const issued = await mutate((db) => {
    const user = db.users.find((item) => item.email === email);
    if (!user) return null;

    const now = Date.now();
    const { token, tokenHash, expiresAt } = newResetToken(now);
    // One live link per account, and expired rows never accumulate.
    db.passwordResets = db.passwordResets.filter(
      (reset) => reset.userId !== user.id && reset.expiresAt > now
    );
    db.passwordResets.push({ tokenHash, userId: user.id, expiresAt });
    return { token, email: user.email };
  });

  if (!issued) return NextResponse.json(GENERIC);

  const sent = await sendPasswordReset({ to: issued.email, token: issued.token });
  if (!sent.ok) {
    return NextResponse.json(
      { error: "We could not send the reset email. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json(GENERIC);
}