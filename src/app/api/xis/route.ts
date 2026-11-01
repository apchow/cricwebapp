import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentSession } from "@/lib/auth";
import { mutate, query } from "@/lib/store";
import { cleanXIPlayers, text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicXI(xi: { id: string; name: string; players: unknown[]; createdAt: string }) {
  return { id: xi.id, name: xi.name, players: xi.players, createdAt: xi.createdAt };
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const xis = await query((db) =>
    db.xis
      .filter((xi) => xi.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(publicXI)
  );
  return NextResponse.json({ xis });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
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
      userId: session.id,
      name,
      players,
      createdAt: new Date().toISOString(),
    };
    db.xis.push(created);
    return publicXI(created);
  });

  return NextResponse.json({ xi }, { status: 201 });
}
