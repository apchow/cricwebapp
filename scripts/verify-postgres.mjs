#!/usr/bin/env node
/* Proves the Postgres driver round-trips, which the file driver cannot.
 *
 * A pooled URL and a jsonb column hide two failures that look identical from
 * the browser: writes encoded as jsonb strings (so every read comes back empty)
 * and read-modify-writes that interleave across instances (so a registration
 * silently deletes itself). Both were real. Run this after any change to
 * src/lib/store.ts:
 *
 *   node scripts/verify-postgres.mjs
 *
 * It writes throwaway rows and removes them again. */

import { existsSync, readFileSync } from "node:fs";

/* Read the connection string from where `vercel env pull` was pointed at, NOT
 * from .env.local: Next loads that file automatically, so a production URL
 * parked there means `npm run dev` writes straight into live user data. */
for (const match of existsSync(".vercel/env.local")
  ? readFileSync(".vercel/env.local", "utf8")
      .split(/\r?\n/)
      .map((line) => /^([A-Z_0-9]+)=(.*)$/.exec(line))
      .filter(Boolean)
  : []) {
  process.env[match[1]] ??= match[2].trim().replace(/^"|"$/g, "");
}

if (!process.env.DATABASE_URL) {
  console.log("skipped: no DATABASE_URL, so this deploy uses file storage");
  process.exit(0);
}

const { mutate, query, storageDriver } = await import("../src/lib/store.ts");
const stamp = Date.now();
const suffix = "@verify-postgres.test";
const user = (n) => ({
  id: `vp-${n}-${stamp}`,
  email: `verify${n}.${stamp}${suffix}`,
  password: "not-a-real-hash",
  createdAt: new Date().toISOString(),
});

const failures = [];
const check = (label, passed, detail) => {
  console.log(`${passed ? "ok  " : "FAIL"} ${label.padEnd(34)} ${detail}`);
  if (!passed) failures.push(label);
};

try {
  check("driver", storageDriver() === "postgres", storageDriver());

  await mutate((db) => {
    db.users = db.users.filter((u) => !u.email.endsWith(suffix));
    db.xis = db.xis.filter((xi) => !xi.id.startsWith(`vp-xi-`));
  });

  await mutate((db) => {
    db.users.push(user(0));
    db.xis.push({
      id: `vp-xi-${stamp}`,
      userId: `vp-0-${stamp}`,
      name: "Verify round trip",
      players: [1, 2, 3],
      createdAt: new Date().toISOString(),
    });
  });

  const readBack = await query((db) => ({
    users: db.users.filter((u) => u.email.endsWith(suffix)).length,
    xis: db.xis.filter((xi) => xi.id.startsWith(`vp-xi-`)).length,
  }));
  check(
    "a write survives the next read",
    readBack.users === 1 && readBack.xis === 1,
    `users=${readBack.users} xis=${readBack.xis} — a jsonb string instead of an object reads back as 0`
  );

  // Five writes at once is what several warm instances do on a busy page.
  await Promise.all([1, 2, 3, 4].map((n) => mutate((db) => void db.users.push(user(n)))));
  const total = await query(
    (db) => db.users.filter((u) => u.email.endsWith(suffix)).length
  );
  check("five parallel writes, none lost", total === 5, `users=${total}`);

  await mutate((db) => {
    db.liveUsage = { day: "verify", count: 1, fetchedAt: stamp };
  });
  const counterRead = await query((db) => db.liveUsage);
  check(
    "nested objects keep their shape",
    counterRead.count === 1 && counterRead.fetchedAt === stamp,
    JSON.stringify(counterRead)
  );
} finally {
  await mutate((db) => {
    db.users = db.users.filter((u) => !u.email.endsWith(suffix));
    db.xis = db.xis.filter((xi) => !xi.id.startsWith(`vp-xi-`));
    db.liveUsage = { day: "", count: 0 };
  });
  const left = await query((db) => db.users.filter((u) => u.email.endsWith(suffix)).length);
  console.log(`cleanup: ${left} test row(s) left behind`);
}

process.exit(failures.length ? 1 : 0);
