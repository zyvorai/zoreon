// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  RateLimitError,
  SlidingWindowLimiter,
  assertMessageBody,
  readIntEnv,
} from "./rate-limit.ts";

test("limiter blocks past the limit and recovers after the window", () => {
  let t = 1000;
  const l = new SlidingWindowLimiter(2, 10_000, () => t);
  assert.equal(l.check("a").ok, true);
  assert.equal(l.check("a").ok, true);
  const r = l.check("a");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.retryAfterMs, 10_000);
  assert.equal(l.check("b").ok, true, "keys are independent");
  t += 10_001;
  assert.equal(l.check("a").ok, true);
});

test("enforce throws a clear RateLimitError", () => {
  const l = new SlidingWindowLimiter(1, 60_000, () => 0);
  l.enforce("u", "messages");
  assert.throws(
    () => l.enforce("u", "messages"),
    (e: unknown) => {
      assert.ok(e instanceof RateLimitError);
      assert.match(e.message, /at most 1 messages per 60s\. Retry in 60s/);
      assert.equal(e.retryAfterSec, 60);
      return true;
    },
  );
});

test("limit 0 disables; key flooding stays bounded", () => {
  const off = new SlidingWindowLimiter(0, 1000);
  for (let i = 0; i < 5; i++) assert.equal(off.check("x").ok, true);
  const l = new SlidingWindowLimiter(5, 60_000, () => 1, 50);
  for (let i = 0; i < 500; i++) l.check(`k${i}`);
  assert.ok((l as unknown as { hits: Map<string, number[]> }).hits.size <= 50);
});

test("readIntEnv ignores junk", () => {
  assert.equal(readIntEnv({ A: "12" }, "A", 5), 12);
  assert.equal(readIntEnv({ A: "0" }, "A", 5), 0);
  for (const v of ["-1", "1e9", "abc", "", " ", "99999999999", "1; drop table"]) {
    assert.equal(readIntEnv({ A: v }, "A", 5), 5, v);
  }
  assert.equal(readIntEnv({}, "A", 5), 5);
});

test("assertMessageBody rejects hostile bodies", () => {
  assert.equal(assertMessageBody("hi"), "hi");
  assert.throws(() => assertMessageBody("   "), /Empty/);
  assert.throws(() => assertMessageBody("a\u0000b"), /NUL/);
  assert.throws(() => assertMessageBody("x".repeat(20_000)), /too long: 20000/);
  assert.throws(() => assertMessageBody({ toString: () => "x" }), /must be text/);
  assert.throws(() => assertMessageBody(null), /must be text/);
});
