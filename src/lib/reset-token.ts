// Relative, extension-qualified imports keep this loadable by `node --test`,
// which does not understand the "@/lib" alias.
import { createHash, randomBytes } from "node:crypto";

/** A reset link is good for one hour. */
export const RESET_TTL_MS = 60 * 60 * 1000;

/** Only the hash is stored, so a leaked document cannot be replayed as a link. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ResetToken {
  /** The secret that goes in the email; never persisted. */
  token: string;
  tokenHash: string;
  expiresAt: number;
}

export function newResetToken(now: number = Date.now()): ResetToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: now + RESET_TTL_MS,
  };
}

export function isResetExpired(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt <= now;
}