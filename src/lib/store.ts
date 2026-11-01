import { promises as fs } from "node:fs";
import path from "node:path";

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
  players: unknown[];
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
  innings: unknown[];
}

export interface StoredState {
  userId: string;
  match: unknown;
  config: unknown;
  updatedAt: string;
}

export interface Database {
  users: StoredUser[];
  xis: StoredXI[];
  matches: StoredMatch[];
  states: StoredState[];
}

function dataDir() {
  return path.join(process.cwd(), "data");
}

function dbFile() {
  return path.join(dataDir(), "crichub.json");
}

async function load(): Promise<Database> {
  try {
    const raw = await fs.readFile(dbFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      xis: Array.isArray(parsed.xis) ? parsed.xis : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      states: Array.isArray(parsed.states) ? parsed.states : [],
    };
  } catch {
    return { users: [], xis: [], matches: [], states: [] };
  }
}

async function save(db: Database): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${dbFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rm(dbFile(), { force: true });
  await fs.rename(tmp, dbFile());
}

let chain: Promise<unknown> = Promise.resolve();

export function query<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  return chain.then(async () => fn(await load()));
}

export function mutate<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  chain = run.catch(() => undefined);
  return run;
}
