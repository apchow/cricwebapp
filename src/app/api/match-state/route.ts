import { NextResponse } from "next/server";
import { jsonBody, sessionGate } from "@/lib/api";
import { mutate, query } from "@/lib/store";
import { cleanConfig, cleanMatch } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;
  const state = await query(
    (db) => db.states.find((item) => item.userId === gate.session.id) ?? null
  );
  return NextResponse.json({ state });
}

export async function PUT(request: Request) {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;

  const body = await jsonBody(request);
  const match = cleanMatch(body?.match);
  const config = cleanConfig(body?.config);
  if (!match || !config) {
    return NextResponse.json({ error: "Invalid match state" }, { status: 400 });
  }

  await mutate((db) => {
    const existing = db.states.find((item) => item.userId === gate.session.id);
    if (existing) {
      existing.match = match;
      existing.config = config;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
    const created = {
      userId: gate.session.id,
      match,
      config,
      updatedAt: new Date().toISOString(),
    };
    db.states.push(created);
    return created;
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;
  await mutate((db) => {
    const index = db.states.findIndex((item) => item.userId === gate.session.id);
    if (index !== -1) db.states.splice(index, 1);
    return index !== -1;
  });
  return NextResponse.json({ ok: true });
}
