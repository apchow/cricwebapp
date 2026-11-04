import { dbClient } from "@/lib/store";

export interface RateLimitOptions {
  /** Keeps separate endpoints from sharing a counter. */
  name: string;
  /** Requests allowed from one client IP inside a window. */
  limit: number;
  /** Fixed window length, in milliseconds. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Whole seconds to wait, for the `Retry-After` header. */
  retryAfterSeconds: number;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

/*
 * In-process counters, used when there is no database. They reset on every
 * cold start and are per instance, which is fine locally and not enough for a
 * public deploy — with DATABASE_URL set the counters move into rate_window and
 * hold across every instance.
 */
const windows = new Map<string, RateWindow>();

/** Ceiling on tracked keys, so spoofed forwarded-for headers cannot grow it. */
const MAX_TRACKED_KEYS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

let nextSweepAt = 0;

function sweep(now: number): void {
  if (now < nextSweepAt) return;
  nextSweepAt = now + SWEEP_INTERVAL_MS;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Insertion order puts the stalest buckets first, so trimming the head bounds
  // memory even when every request arrives from a new key.
  while (windows.size > MAX_TRACKED_KEYS) {
    const stalest = windows.keys().next();
    if (stalest.done) break;
    windows.delete(stalest.value);
  }
}

/** Leftmost `x-forwarded-for` entry; local requests have none. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0]?.trim() : "";
  return first || "unknown";
}

function currentWindow(key: string, windowMs: number, now: number): RateWindow {
  const existing = windows.get(key);
  if (existing && existing.resetAt > now) return existing;
  windows.delete(key);
  const fresh: RateWindow = {
    count: 0,
    resetAt: Math.floor(now / windowMs) * windowMs + windowMs,
  };
  windows.set(key, fresh);
  return fresh;
}

function localLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number
): RateLimitDecision {
  sweep(now);
  const window = currentWindow(key, windowMs, now);
  window.count += 1;
  return {
    allowed: window.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

let lastPruneAt = 0;

async function sharedLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number
): Promise<RateLimitDecision> {
  const run = dbClient();
  if (!run) throw new Error("shared limiter needs a database client");

  const windowStart = Math.floor(now / windowMs) * windowMs;
  const rows = await run<{ count: number }[]>`
    INSERT INTO rate_window (bucket, window_start, count, updated_at)
    VALUES (${key}, ${windowStart}, 1, now())
    ON CONFLICT (bucket) DO UPDATE
    SET count = CASE
          WHEN rate_window.window_start = ${windowStart}
          THEN rate_window.count + 1 ELSE 1 END,
        window_start = ${windowStart},
        updated_at = now()
    RETURNING count
  `;

  if (now - lastPruneAt > 10 * 60_000) {
    lastPruneAt = now;
    await run`DELETE FROM rate_window WHERE updated_at < now() - interval '1 day'`;
  }

  const count = rows[0]?.count ?? 1;
  return {
    allowed: count <= limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart + windowMs - now) / 1000)
    ),
  };
}

/** Counts this request against the caller's IP and says whether to proceed. */
export async function rateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitDecision> {
  const now = Date.now();
  const key = `${options.name}:${clientIp(request)}`;
  if (!dbClient()) return localLimit(key, options, now);

  try {
    return await sharedLimit(key, options, now);
  } catch {
    /*
     * Fail closed on the auth-critical endpoints: if the limiter's own storage
     * is unreachable, an attacker is exactly who we should not be waving
     * through. The database is already required to log in at all.
     */
    return { allowed: false, retryAfterSeconds: 30 };
  }
}
