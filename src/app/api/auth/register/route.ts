import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  hashPassword,
  normalizeEmail,
  startSession,
  validEmail,
  validPassword,
} from "@/lib/auth";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
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
