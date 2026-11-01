import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentSession } from "@/lib/auth";
import { mutate, query } from "@/lib/store";
import { cleanMatchEntry } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMatch(match: {
  id: string;
  createdAt: string;
  format: string;
  venue: string;
  scoreline: string;
  result: string;
  innings: unknown[];
}) {
  return {
    id: match.id,
    createdAt: match.createdAt,
    format: match.format,
    venue: match.venue,
    scoreline: match.scoreline,
    result: match.result,
    innings: match.innings,
  };
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const matches = await query((db) =>
    db.matches
      .filter((match) => match.userId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(publicMatch)
  );
  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const entry = cleanMatchEntry(body);
  if (!entry) {
    return NextResponse.json({ error: "That match could not be saved" }, { status: 400 });
  }

  const match = await mutate((db) => {
    const created = {
      id: randomUUID(),
      userId: session.id,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    db.matches.push(created);
    return publicMatch(created);
  });

  return NextResponse.json({ match }, { status: 201 });
}
