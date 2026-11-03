import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sessionGate } from "@/lib/api";
import { mutate } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mint (or return the existing) public share token for one of the caller's matches. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const token = await mutate((db) => {
    const match = db.matches.find(
      (item) => item.id === id && item.userId === gate.session.id
    );
    if (!match) return null;
    if (!match.shareToken) match.shareToken = randomBytes(9).toString("base64url");
    return match.shareToken;
  });

  if (!token) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  return NextResponse.json({ token });
}
