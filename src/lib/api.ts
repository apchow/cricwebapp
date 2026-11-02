import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

export type SessionGate =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Resolve the signed-in user or the 401 response to return. Route handlers do
 * `const gate = await sessionGate(); if (!gate.ok) return gate.response;`
 * so the "Sign in required" payload only exists here.
 */
export async function sessionGate(): Promise<SessionGate> {
  const session = await currentSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/** Parse a JSON object body, treating malformed or non-object bodies as absent. */
export async function jsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
