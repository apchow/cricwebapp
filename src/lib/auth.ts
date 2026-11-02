import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import type { StoredUser } from "@/lib/store";

export const SESSION_COOKIE = "crichub_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

let secretPromise: Promise<string> | null = null;

async function loadSecret(): Promise<string> {
  const fromEnv = process.env.CRICHUB_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(process.cwd(), "data", ".session-secret");
  try {
    const existing = (await fs.readFile(file, "utf8")).trim();
    if (existing.length >= 32) return existing;
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
  }
  const generated = randomBytes(32).toString("hex");
  await fs.writeFile(file, generated, { mode: 0o600 });
  return generated;
}

async function secret(): Promise<string> {
  if (!secretPromise) secretPromise = loadSecret();
  return secretPromise;
}

async function sign(data: string): Promise<string> {
  return createHmac("sha256", await secret()).update(data).digest("base64url");
}

export async function createSession(user: SessionUser): Promise<string> {
  const payload = encode(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 864e5 })
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifySession(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(decode(payload)) as SessionUser & {
      exp: number;
    };
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (typeof parsed.id !== "string" || typeof parsed.email !== "string") {
      return null;
    }
    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}

export async function currentSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: await createSession(user),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 200;
}

export function validPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}

function derive(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("base64url"));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${await derive(password, salt)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const computed = await derive(password, salt);
  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function publicUser(user: StoredUser): SessionUser {
  return { id: user.id, email: user.email };
}
