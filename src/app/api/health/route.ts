import { NextResponse } from "next/server";
import { query, storageDriver } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check: proves the storage driver answers and reports which
 * one is live. Nothing user-specific is exposed.
 */
export async function GET() {
  const driver = storageDriver();
  let storageOk = false;

  try {
    await query((db) => db.users.length);
    storageOk = true;
  } catch {
    storageOk = false;
  }

  return NextResponse.json(
    {
      ok: storageOk,
      driver,
      liveFeed: Boolean(process.env.CRICAPI_KEY),
      checkedAt: new Date().toISOString(),
    },
    { status: storageOk ? 200 : 503 }
  );
}
