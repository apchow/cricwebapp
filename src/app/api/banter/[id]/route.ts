import { NextResponse } from "next/server";
import { writeGate } from "@/lib/api";
import { displayPosts } from "@/lib/banter";
import { mutate, query } from "@/lib/store";

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
    const index = db.banter.findIndex(
      (post) => post.id === id && post.userId === gate.session.id
    );
    if (index === -1) return false;
    db.banter.splice(index, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json(
      { error: "You can only remove your own takes." },
      { status: 404 }
    );
  }

  const posts = await query((db) => db.banter);
  return NextResponse.json({ posts: displayPosts(posts, gate.session) });
}
