import { NextResponse } from "next/server";
import {
  normalizeEmail,
  startSession,
  validEmail,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
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
