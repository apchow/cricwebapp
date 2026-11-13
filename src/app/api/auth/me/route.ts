import { NextResponse } from "next/server";
import { currentSession, isDemoEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  return NextResponse.json({
    user: session ? { ...session, demo: isDemoEmail(session.email) } : null,
  });
}
