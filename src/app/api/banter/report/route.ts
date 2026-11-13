import { NextResponse } from "next/server";
import { jsonBody, writeGate } from "@/lib/api";
import { displayPosts } from "@/lib/banter";
import { mutate, query } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flag a take for the umpires to review. One report per person, never on your
 * own post. Reports are recorded for moderation; they do not auto-remove a post.
 */
export async function POST(request: Request) {
  const gate = await writeGate();
  if (!gate.ok) return gate.response;

  const limit = await rateLimit(request, {
    name: "banter-report",
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Slow down — too many reports at once." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await jsonBody(request);
  const id = text(body?.id, 40);
  if (!id) return NextResponse.json({ error: "No post given" }, { status: 400 });

  const result = await mutate((db) => {
    const post = db.banter.find((item) => item.id === id);
    if (!post) return "missing" as const;
    if (post.userId === gate.session.id) return "own" as const;
    const reports = post.reports ?? [];
    if (!reports.includes(gate.session.id)) {
      post.reports = [...reports, gate.session.id];
    }
    return "ok" as const;
  });

  if (result === "missing") {
    return NextResponse.json(
      { error: "That post has rolled off the wall." },
      { status: 404 }
    );
  }
  if (result === "own") {
    return NextResponse.json(
      { error: "You cannot report your own take." },
      { status: 400 }
    );
  }

  const posts = await query((db) => db.banter);
  return NextResponse.json({ posts: displayPosts(posts, gate.session) });
}