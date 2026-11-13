import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonBody, sessionGate, writeGate } from "@/lib/api";
import { toPublicSeries } from "@/lib/dto";
import { mutate, query } from "@/lib/store";
import { cleanStringIds, text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;
  const series = await query((db) =>
    db.series
      .filter((item) => item.userId === gate.session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicSeries)
  );
  return NextResponse.json({ series });
}

export async function POST(request: Request) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const body = await jsonBody(request);
  const name = text(body?.name, 60);
  if (!name) {
    return NextResponse.json({ error: "Give the series a name" }, { status: 400 });
  }
  const requested = cleanStringIds(body?.matchIds) ?? [];

  const series = await mutate((db) => {
    // Only matches the caller owns may join their series.
    const owned = new Set(
      db.matches
        .filter((match) => match.userId === gate.session.id)
        .map((match) => match.id)
    );
    const created = {
      id: randomUUID(),
      userId: gate.session.id,
      name,
      createdAt: new Date().toISOString(),
      matchIds: requested.filter((id) => owned.has(id)),
    };
    db.series.push(created);
    return toPublicSeries(created);
  });

  return NextResponse.json({ series }, { status: 201 });
}
