import { NextResponse } from "next/server";
import { sessionSecretState } from "@/lib/auth";
import { mutate, storageDriver } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check. It performs a *write*, not a read: on a read-only
 * filesystem reads succeed while every save fails afterwards, so a read-only
 * probe would call a broken deploy healthy. Nothing user-specific is exposed.
 */
export async function GET() {
  const driver = storageDriver();
  const onServerless = Boolean(process.env.VERCEL);
  const warnings: string[] = [];
  let ok = true;
  let error: string | undefined;

  try {
    await mutate((db) => db.users.length);
  } catch {
    ok = false;
    error =
      driver === "file" && onServerless
        ? "File storage cannot persist on a serverless host. Set DATABASE_URL and apply db/schema.sql."
        : "Storage is not answering.";
  }

  const secretSource = await sessionSecretState();
  const configured = process.env.CRICHUB_SECRET ?? "";
  if (configured && configured.length < 16) {
    warnings.push(
      "CRICHUB_SECRET is shorter than 16 characters, so it was ignored."
    );
  }
  if (secretSource === "ephemeral") {
    warnings.push(
      "No CRICHUB_SECRET and no writable disk: sessions die on every cold start."
    );
  }

  return NextResponse.json(
    {
      ok,
      driver,
      ...(error ? { error } : {}),
      secret: secretSource,
      liveFeed: Boolean(process.env.CRICAPI_KEY),
      ...(warnings.length ? { warnings } : {}),
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
