import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const removed = await mutate((db) => {
    const index = db.xis.findIndex(
      (xi) => xi.id === params.id && xi.userId === session.id
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
