#!/usr/bin/env node
/* Apply db/schema.sql without a psql client.

   Vercel's own Neon connection string is not something you want to paste into
   a shell by hand, and Windows machines rarely have psql at all, so this reads
   the schema and runs it with the same driver the app uses. It is safe to re
   run — every statement in the file is IF NOT EXISTS, and doing so prints
   `relation "app_state" already exists, skipping` notices from Postgres, which
   are expected rather than an error.

     node scripts/apply-schema.mjs
*/

import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const match of readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => /^([A-Z_0-9]+)=(.*)$/.exec(line))
    .filter(Boolean)) {
    process.env[match[1]] ??= match[2].trim().replace(/^"|"$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("skipped: no DATABASE_URL, so this deploy uses file storage");
  process.exit(0);
}

const { default: postgres } = await import("postgres");
const sql = postgres(url, { max: 1, connect_timeout: 15 });

try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  const rows = await sql`SELECT count(*) AS n FROM app_state`;
  console.log("tables:", tables.map((t) => t.table_name).join(", "));
  console.log(`app_state rows: ${rows[0].n} (0 is normal — the first request creates it)`);
} catch (error) {
  console.error("apply failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
