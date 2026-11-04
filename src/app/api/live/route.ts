import { NextResponse } from "next/server";
import { fetchLiveFeed } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await fetchLiveFeed();
  return NextResponse.json(feed);
}
