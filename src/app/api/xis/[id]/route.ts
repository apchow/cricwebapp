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
    const index = db.xis.findIndex(
      (xi) => xi.id === id && xi.userId === gate.session.id
    );
    if (index === -1) return false;
    db.xis.splice(index, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "XI not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
