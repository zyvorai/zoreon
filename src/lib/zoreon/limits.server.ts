// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Process-local abuse limits for message writes and exports. Tunable via env
 * (docs/ENV.md); `0` disables a limit. Per-replica: with several app replicas
 * the effective limit is multiplied by the replica count.
 */
import {
  DEFAULT_MAX_MESSAGE_CHARS,
  SlidingWindowLimiter,
  assertMessageBody,
  readIntEnv,
} from "./rate-limit";

type Who = { id?: string | null; email?: string | null } | null | undefined;

let writes: SlidingWindowLimiter | undefined;
let exports_: SlidingWindowLimiter | undefined;

function writeLimiter() {
  writes ??= new SlidingWindowLimiter(
    readIntEnv(process.env, "ZOREON_RATE_MESSAGES_PER_MIN", 60),
    60_000,
  );
  return writes;
}

function exportLimiter() {
  exports_ ??= new SlidingWindowLimiter(
    readIntEnv(process.env, "ZOREON_RATE_EXPORTS_PER_MIN", 6),
    60_000,
  );
  return exports_;
}

function keyOf(who: Who): string {
  return who?.id || who?.email?.trim().toLowerCase() || "anonymous";
}

/** Validate the body and charge one message write to the user. */
export function guardMessageWrite(who: Who, body: unknown): void {
  assertMessageBody(
    body,
    readIntEnv(process.env, "ZOREON_MAX_MESSAGE_CHARS", DEFAULT_MAX_MESSAGE_CHARS),
  );
  writeLimiter().enforce(keyOf(who), "message writes");
}

export function guardExport(who: Who): void {
  exportLimiter().enforce(keyOf(who), "timeline exports");
}
