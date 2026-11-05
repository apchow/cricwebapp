import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import type { Innings } from "@/lib/scoring";

export interface StoredUser {
  id: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface StoredXI {
  id: string;
  userId: string;
  name: string;
  players: number[];
  createdAt: string;
}

export interface StoredMatch {
  id: string;
  userId: string;
  createdAt: string;
  format: string;
  venue: string;
  scoreline: string;
  result: string;
  innings: Innings[];
  /** Set once the owner mints a public share link for this match. */
  shareToken?: string;
}

export interface StoredSeries {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  /** Ids of the owner's matches that make up the series. */
  matchIds: string[];
}

export interface StoredState {
  userId: string;
  match: unknown;
  config: unknown;
  updatedAt: string;
}

export interface StoredBanter {
  id: string;
  userId: string;
  author: string;
  text: string;
  createdAt: string;
  /** User ids who liked it, so counts are shared rather than per-browser. */
  likes: string[];
}

export interface DailyUsage {
  /** ISO day the counter belongs to. */
  day: string;
  count: number;
  /** Epoch ms of the last upstream call, so instances share one interval. */
  fetchedAt?: number;
  /**
   * The feed that call produced. Serverless instances do not share memory, so
   * without this each cold lambda would spend its own quota on the same four
   * minutes. Untyped to keep the store from importing the live module.
   */
  feed?: unknown;
}

export interface Database {
  users: StoredUser[];
  xis: StoredXI[];
  matches: StoredMatch[];
  series: StoredSeries[];
  states: StoredState[];
  banter: StoredBanter[];
  /** Upstream live-score calls spent today, shared across instances. */
  liveUsage: DailyUsage;
}

const EMPTY_DOC: Database = {
  users: [],
  xis: [],
  matches: [],
  series: [],
  states: [],
  banter: [],
  liveUsage: { day: "", count: 0 },
};

function dataDir() {
  return path.join(process.cwd(), "data");
}

function dbFile() {
  return path.join(dataDir(), "crichub.json");
}

/** Accepts anything on disk, so a half-written or older document still loads. */
function normalize(value: unknown): Database {
  const doc = (value ?? {}) as Partial<Database>;
  const list = <T>(input: unknown): T[] => (Array.isArray(input) ? input as T[] : []);
  const usage = (doc.liveUsage ?? {}) as Partial<DailyUsage>;
  return {
    users: list<StoredUser>(doc.users),
    xis: list<StoredXI>(doc.xis),
    matches: list<StoredMatch>(doc.matches),
    series: list<StoredSeries>(doc.series),
    states: list<StoredState>(doc.states),
    banter: list<StoredBanter>(doc.banter),
    liveUsage: {
      day: typeof usage.day === "string" ? usage.day : "",
      count: typeof usage.count === "number" && usage.count > 0 ? usage.count : 0,
      ...(typeof usage.fetchedAt === "number" ? { fetchedAt: usage.fetchedAt } : {}),
      ...(usage.feed === undefined ? {} : { feed: usage.feed }),
    },
  };
}

/* ── file driver (local development) ───────────────────────── */

async function readFile(): Promise<Database> {
  try {
    return normalize(JSON.parse(await fs.readFile(dbFile(), "utf8")));
  } catch {
    return structuredClone(EMPTY_DOC);
  }
}

async function writeFile(db: Database): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${dbFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rm(dbFile(), { force: true });
  await fs.rename(tmp, dbFile());
}

/* ── postgres driver (Vercel and any hosted deploy) ─────────── */

const connectionString = process.env.DATABASE_URL ?? "";
const usingPostgres = connectionString.length > 0;

type Sql = postgres.Sql;

let sqlInstance: Sql | null = null;

function sql(): Sql {
  if (!sqlInstance) {
    sqlInstance = postgres(connectionString, {
      // One connection per lambda instance: the row lock serialises the
      // read-modify-write, and more connections would only queue anyway.
      max: 1,
      prepare: false,
      idle_timeout: 10,
      connect_timeout: 10,
    });
  }
  return sqlInstance;
}

async function readRow(run: Sql): Promise<Database> {
  const rows = await run<{ data: unknown }[]>`
    SELECT data FROM app_state WHERE id = 1
  `;
  return normalize(rows[0]?.data);
}

async function writeRow(run: Sql, db: Database): Promise<void> {
  await run`
    INSERT INTO app_state (id, data, updated_at)
    VALUES (1, ${JSON.stringify(db)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, updated_at = now()
  `;
}

/**
 * The document is read-modify-written as one unit, so two requests must not
 * interleave. On a single process the chain below does that; across serverless
 * instances the database does it. The lock is a *row* lock, not an advisory
 * one: pooled endpoints such as Neon hand each transaction to a different
 * backend, and a session-scoped advisory lock excludes nothing there. Two
 * interleaved read-modify-writes silently delete each other's users.
 *
 * Every statement inside the transaction runs on `tx`, never on the bare pool,
 * or the lock would protect nothing.
 */
async function withLock<T>(run: (tx: Sql) => Promise<T>): Promise<T> {
  const rows = await sql().begin(async (tx): Promise<unknown[]> => {
    await tx`
      INSERT INTO app_state (id, data)
      VALUES (1, ${JSON.stringify(EMPTY_DOC)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
    await tx`SELECT id FROM app_state WHERE id = 1 FOR UPDATE`;
    return [await run(tx as unknown as Sql)];
  });
  return rows[0] as T;
}

let chain: Promise<unknown> = Promise.resolve();

export function query<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  if (usingPostgres) {
    return withLock(async (tx) => fn(await readRow(tx)));
  }
  return chain.then(async () => fn(await readFile()));
}

export function mutate<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  if (usingPostgres) {
    return withLock(async (tx) => {
      const db = await readRow(tx);
      const result = await fn(db);
      await writeRow(tx, db);
      return result;
    });
  }

  const run = chain.then(async () => {
    const db = await readFile();
    const result = await fn(db);
    await writeFile(db);
    return result;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** Shared client so the limiter and the document store use one pool. */
export function dbClient(): Sql | null {
  return usingPostgres ? sql() : null;
}

/** Which driver is live — surfaced by the health endpoint. */
export function storageDriver(): "postgres" | "file" {
  return usingPostgres ? "postgres" : "file";
}
