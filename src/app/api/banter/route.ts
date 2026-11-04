import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonBody, sessionGate } from "@/lib/api";
import {
  BANTER_WINDOW,
  authorLabel,
  cleanBanterText,
  displayPosts,
  flaggedHit,
  trimBanter,
} from "@/lib/banter";
import { mutate, query } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reading the wall is public; posting needs an account. */
export async function GET() {
  const gate = await sessionGate();
  const viewer = gate.ok ? gate.session : null;
  const posts = await query((db) => db.banter);
  return NextResponse.json({
    posts: displayPosts(posts, viewer),
    window: BANTER_WINDOW,
  });
}

export async function POST(request: Request) {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;

  /*
   * Slightly under the window size per short period: enough for a live-match
   * argument, not enough for one browser to own the wall.
   */
  const limit = rateLimit(request, {
    name: "banter-post",
    limit: 8,
    windowMs: 5 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Slow down — the wall allows 8 posts every 5 minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await jsonBody(request);
  const text = cleanBanterText(body?.text);
  if (!text) {
    return NextResponse.json(
      { error: "A take is 3 to 240 characters." },
      { status: 400 }
    );
  }

  const hit = flaggedHit(text);
  if (hit) {
    return NextResponse.json(
      { error: `Silenced — "${hit}" does not get past the umpires.` },
      { status: 400 }
    );
  }

  const created = await mutate((db) => {
    const post = {
      id: randomUUID(),
      userId: gate.session.id,
      author: authorLabel(gate.session.email),
      text,
      createdAt: new Date().toISOString(),
      likes: [],
    };
    db.banter = trimBanter([...db.banter, post]);
    return post;
  });

  const posts = await query((db) => db.banter);
  return NextResponse.json(
    { post: created, posts: displayPosts(posts, gate.session) },
    { status: 201 }
  );
}
