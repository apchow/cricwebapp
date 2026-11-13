import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonBody, sessionGate, writeGate } from "@/lib/api";
import { toPublicMatch } from "@/lib/dto";
import { mutate, query } from "@/lib/store";
import { cleanMatchEntry } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;
  const matches = await query((db) =>
    db.matches
      .filter((match) => match.userId === gate.session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(toPublicMatch)
  );
  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const body = await jsonBody(request);
  const entry = cleanMatchEntry(body);
  if (!entry) {
    return NextResponse.json({ error: "That match could not be saved" }, { status: 400 });
  }

  const match = await mutate((db) => {
    const created = {
      id: randomUUID(),
      userId: gate.session.id,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    db.matches.push(created);
    return toPublicMatch(created);
  });

  return NextResponse.json({ match }, { status: 201 });
}
