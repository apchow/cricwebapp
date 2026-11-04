import { NextResponse } from "next/server";
import { jsonBody, sessionGate } from "@/lib/api";
import { displayPosts } from "@/lib/banter";
import { mutate, query } from "@/lib/store";
import { text } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await sessionGate();
  if (!gate.ok) return gate.response;

  const body = await jsonBody(request);
  const id = text(body?.id, 40);
  if (!id) return NextResponse.json({ error: "No post given" }, { status: 400 });

  const changed = await mutate((db) => {
    const post = db.banter.find((item) => item.id === id);
    if (!post) return false;
    post.likes = post.likes.includes(gate.session.id)
      ? post.likes.filter((liker) => liker !== gate.session.id)
      : [...post.likes, gate.session.id];
    return true;
  });

  if (!changed) {
    return NextResponse.json(
      { error: "That post has rolled off the wall." },
      { status: 404 }
    );
  }

  const posts = await query((db) => db.banter);
  return NextResponse.json({ posts: displayPosts(posts, gate.session) });
}
