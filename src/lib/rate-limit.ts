interface RateWindow {
  count: number;
  resetAt: number;
}

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

// Counters live in this process only: a restart (or a second instance) clears
// them, which is acceptable for slowing down credential stuffing.
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

/** Counts this request against the caller's IP and says whether to proceed. */
export function rateLimit(
  request: Request,
  { name, limit, windowMs }: RateLimitOptions
): RateLimitDecision {
  const now = Date.now();
  sweep(now);
  const window = currentWindow(`${name}:${clientIp(request)}`, windowMs, now);
  window.count += 1;
  return {
    allowed: window.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}
