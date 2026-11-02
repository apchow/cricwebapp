import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonBody, sessionGate } from "@/lib/api";
import { toPublicXI } from "@/lib/dto";
import { mutate, query } from "@/lib/store";
import { cleanXIPlayers, text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;
  const xis = await query((db) =>
    db.xis
      .filter((xi) => xi.userId === gate.session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(toPublicXI)
  );
  return NextResponse.json({ xis });
}

export async function POST(request: Request) {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;

  const body = await jsonBody(request);
  const name = text(body?.name, 40);
  const players = cleanXIPlayers(body?.players);
  if (!name || !players) {
    return NextResponse.json(
      { error: "Give the XI a name and pick up to 11 players" },
      { status: 400 }
    );
  }

  const xi = await mutate((db) => {
    const created = {
      id: randomUUID(),
      userId: gate.session.id,
      name,
      players,
      createdAt: new Date().toISOString(),
    };
    db.xis.push(created);
    return toPublicXI(created);
  });

  return NextResponse.json({ xi }, { status: 201 });
}
