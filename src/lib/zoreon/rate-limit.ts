// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Per-key sliding-window rate limiter and message-body guard. Pure and
 * clock-injectable so it can be unit-tested without a server.
 */

export class RateLimitError extends Error {
  readonly retryAfterSec: number;
  constructor(what: string, limit: number, windowMs: number, retryAfterMs: number) {
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(
      `Rate limit exceeded: at most ${limit} ${what} per ${Math.round(windowMs / 1000)}s. Retry in ${retryAfterSec}s.`,
    );
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export type LimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  readonly limit: number;
  readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;
  constructor(limit: number, windowMs: number, now: () => number = Date.now, maxKeys = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
  }

  /** Record one hit for `key` unless over the limit. limit <= 0 disables the limiter. */
  check(key: string): LimitResult {
    if (this.limit <= 0) return { ok: true, remaining: Number.POSITIVE_INFINITY };
    const t = this.now();
    const cutoff = t - this.windowMs;
    const live = (this.hits.get(key) ?? []).filter((x) => x > cutoff);
    if (live.length >= this.limit) {
      this.hits.set(key, live);
      return { ok: false, retryAfterMs: Math.max(1, live[0]! + this.windowMs - t) };
    }
    live.push(t);
    this.hits.delete(key); // re-insert so Map order approximates recency
    this.hits.set(key, live);
    if (this.hits.size > this.maxKeys) this.prune(cutoff);
    return { ok: true, remaining: this.limit - live.length };
  }

  /** Throw RateLimitError when over the limit. */
  enforce(key: string, what: string): void {
    const r = this.check(key);
    if (!r.ok) throw new RateLimitError(what, this.limit, this.windowMs, r.retryAfterMs);
  }

  private prune(cutoff: number): void {
    for (const [k, v] of this.hits) {
      if (!v.some((x) => x > cutoff)) this.hits.delete(k);
    }
    // Still too many live keys (key-flooding): drop the least recently used.
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }
}

/** Parse a non-negative integer env value; unset/invalid falls back, "0" disables. */
export function readIntEnv(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
): number {
  const raw = env[name]?.trim();
  if (!raw || !/^\d{1,9}$/.test(raw)) return fallback;
  return Number(raw);
}

export const DEFAULT_MAX_MESSAGE_CHARS = 16_000;

/** Reject empty, oversized or NUL-containing message bodies with a clear error. */
export function assertMessageBody(body: unknown, maxChars = DEFAULT_MAX_MESSAGE_CHARS): string {
  if (typeof body !== "string") throw new Error("Message body must be text");
  if (body.includes("\u0000")) throw new Error("Message body contains a NUL byte");
  if (!body.trim()) throw new Error("Empty message");
  if (maxChars > 0 && body.length > maxChars) {
    throw new Error(`Message too long: ${body.length} characters (limit ${maxChars})`);
  }
  return body;
}
