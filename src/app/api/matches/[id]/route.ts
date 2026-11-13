import { NextResponse } from "next/server";
import { writeGate } from "@/lib/api";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const removed = await mutate((db) => {
    const index = db.matches.findIndex(
      (match) => match.id === id && match.userId === gate.session.id
    );
    if (index === -1) return false;
    db.matches.splice(index, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
