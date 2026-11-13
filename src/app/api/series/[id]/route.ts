import { NextResponse } from "next/server";
import { jsonBody, writeGate } from "@/lib/api";
import { toPublicSeries } from "@/lib/dto";
import { mutate } from "@/lib/store";
import { cleanStringIds, text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await jsonBody(request);
  const name = body?.name === undefined ? undefined : text(body.name, 60);
  if (body?.name !== undefined && name === null) {
    return NextResponse.json({ error: "Give the series a name" }, { status: 400 });
  }
  const matchIds =
    body?.matchIds === undefined ? undefined : cleanStringIds(body.matchIds);
  if (body?.matchIds !== undefined && matchIds === null) {
    return NextResponse.json({ error: "Invalid match list" }, { status: 400 });
  }

  const series = await mutate((db) => {
    const existing = db.series.find(
      (item) => item.id === id && item.userId === gate.session.id
    );
    if (!existing) return null;
    if (name) existing.name = name;
    if (matchIds) {
      const owned = new Set(
        db.matches
          .filter((match) => match.userId === gate.session.id)
          .map((match) => match.id)
      );
      existing.matchIds = matchIds.filter((matchId) => owned.has(matchId));
    }
    return toPublicSeries(existing);
  });

  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }
  return NextResponse.json({ series });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const removed = await mutate((db) => {
    const index = db.series.findIndex(
      (item) => item.id === id && item.userId === gate.session.id
    );
    if (index === -1) return false;
    db.series.splice(index, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
