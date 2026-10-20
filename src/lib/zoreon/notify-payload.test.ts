import assert from "node:assert/strict";
import test from "node:test";
import { toNotifyPayload } from "./notify-payload.ts";

test("small events pass through as valid JSON", () => {
  const ev = { type: "ping", at: 1 };
  assert.deepEqual(JSON.parse(toNotifyPayload(ev)!), ev);
});

test("oversized preview is dropped, result stays valid JSON", () => {
  const ev = { type: "refresh", reason: "m", at: 1, preview: "x".repeat(9000) };
  const out = toNotifyPayload(ev);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { type: "refresh", reason: "m", at: 1 });
});

test("irreducible oversized events are skipped, not truncated", () => {
  assert.equal(toNotifyPayload({ type: "ping", at: 1, junk: "x".repeat(9000) }), null);
});
