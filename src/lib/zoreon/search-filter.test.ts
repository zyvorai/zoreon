// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchQuery } from "./search-parse.ts";
import { applySearchFilters, canSeeChannel } from "./search-filter.ts";

test("DM channels are hidden from non-members, other kinds are open", () => {
  assert.equal(canSeeChannel("channel", "[]", null), true);
  assert.equal(canSeeChannel("dm", '["u1","u2"]', "u1"), true);
  assert.equal(canSeeChannel("dm", '["u1","u2"]', "u3"), false);
  assert.equal(canSeeChannel("dm", '["u1","u2"]', null), false);
  assert.equal(canSeeChannel("dm", "not json", "u1"), false);
  assert.equal(canSeeChannel("dm", '{"u1":1}', "u1"), false);
  assert.equal(canSeeChannel("dm", null, "u1"), false);
});

const rows = [
  { id: "1", channel_id: "ch-ops", body: "see https://x.io", created_at: 1000, author_id: "u-bob" },
  { id: "2", channel_id: "ch-dev", body: "plain", created_at: "2000", author_id: "u-ann" },
];

test("applySearchFilters", () => {
  const f = (q: string) => applySearchFilters(rows, parseSearchQuery(q)).map((r) => r.id);
  assert.deepEqual(f("in:#ops"), ["1"]);
  assert.deepEqual(f("from:ANN"), ["2"]);
  assert.deepEqual(f("has:link"), ["1"]);
  assert.deepEqual(f("after:1970-01-01"), ["1", "2"]);
  assert.deepEqual(f("before:1970-01-01"), []);
  assert.deepEqual(f("after:garbage"), ["1", "2"]);
  assert.deepEqual(f("in:ops from:ann"), []);
});

test("is: filters by incident marker", () => {
  const marked = [
    { id: "d", channel_id: "c", body: "DECISION: roll back", created_at: 1, author_id: "u" },
    { id: "f", channel_id: "c", body: "hi\n- [ ] file ticket @bob", created_at: 2, author_id: "u" },
    { id: "n", channel_id: "c", body: "note: deploy at 3", created_at: 3, author_id: "u" },
    { id: "u", channel_id: "c", body: "STATUS: mitigated", created_at: 4, author_id: "u" },
    { id: "x", channel_id: "c", body: "we made a decision: later", created_at: 5, author_id: "u" },
  ];
  const f = (q: string) => applySearchFilters(marked, parseSearchQuery(q)).map((r) => r.id);
  assert.deepEqual(f("is:decision"), ["d"]);
  assert.deepEqual(f("is:follow-up"), ["f"]);
  assert.deepEqual(f("is:todo"), ["f"]);
  assert.deepEqual(f("is:note"), ["n"]);
  assert.deepEqual(f("is:update"), ["u"]);
  assert.deepEqual(f("is:bogus"), ["d", "f", "n", "u", "x"]);
  const p = parseSearchQuery("is:decision rollback");
  assert.equal(p.freeText, "rollback");
  assert.equal(p.is, "decision");
  assert.ok(!p.mmTerms.includes("is:"));
});
