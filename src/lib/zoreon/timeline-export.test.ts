// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  REDACTED,
  buildTimeline,
  escapeMarkdown,
  redactSecrets,
  stripUnsafeChars,
  timelineToJson,
  timelineToMarkdown,
} from "./timeline-export.ts";

const msg = (id: string, body: string, createdAt: number, extra = {}) => ({
  id,
  authorId: "u1",
  body,
  createdAt,
  ...extra,
});

test("redacts common secret shapes", () => {
  const cases = [
    "key AKIAABCDEFGHIJKLMNOP end",
    "gh ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "slack xoxb-1234567890-abcdefghij",
    "Authorization: Bearer abcdefgh12345678",
    "postgres://admin:hunter2@db.internal/app",
    'password = "correct horse"',
    "API_KEY=abc123def",
    "jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----",
  ];
  for (const c of cases) {
    const out = redactSecrets(c);
    assert.ok(out.includes(REDACTED), c);
    assert.ok(!/hunter2|correct horse|abc123def|AKIAABC|MIIabc|abcdefgh12345678/.test(out), out);
  }
  assert.equal(redactSecrets("plain deploy at 10:00"), "plain deploy at 10:00");
});

test("strips control and bidi characters", () => {
  assert.equal(stripUnsafeChars("a\u0000b‮c​d\r\ne"), "abcd\ne");
});

test("markdown/HTML injection is neutralised", () => {
  const evil =
    "<script>alert(1)</script> [x](javascript:alert(1)) ![i](http://e/x.png) # H\n| a | b |";
  const t = buildTimeline([msg("m1", evil, 1_000)], { channelName: "# <b>ch</b>" });
  const md = timelineToMarkdown(t);
  assert.ok(!md.includes("<script>"));
  assert.ok(!md.includes("<b>"));
  assert.ok(!/\[x\]\(/.test(md));
  assert.ok(!/!\[i\]\(/.test(md));
  assert.ok(md.includes("&lt;script&gt;"));
  for (const l of md.split("\n").filter((l) => l.includes("alert") || l.includes("| a"))) {
    assert.ok(l.startsWith("  > "), l);
  }
  assert.equal(escapeMarkdown("a_b*c"), "a\\_b\\*c");
});

test("JSON export is valid and carries redacted text", () => {
  const t = buildTimeline([msg("m1", "token=s3cr3t", 5, { updatedAt: 9, parentId: "p" })], {
    channelName: "war-room",
    generatedAt: 0,
    authors: { u1: { name: "Ada" } },
  });
  const parsed = JSON.parse(timelineToJson(t));
  assert.equal(parsed.schema, "zoreon.timeline.v1");
  assert.equal(parsed.entries[0].author, "Ada");
  assert.equal(parsed.entries[0].body, `token=${REDACTED}`);
  assert.equal(parsed.entries[0].edited, true);
  assert.equal(parsed.generatedAt, "1970-01-01T00:00:00.000Z");
});

test("huge payloads are capped and filters apply", () => {
  const big = "x".repeat(5_000_000);
  const t = buildTimeline([msg("a", big, 1), msg("b", "y", 2), msg("c", "z", 3)], {
    channelName: "c",
    maxMessages: 2,
    maxBodyChars: 100,
    until: 3,
    since: 1,
  });
  assert.equal(t.entries.length, 2);
  assert.equal(t.truncated, true);
  assert.equal(t.omitted, 1);
  assert.ok(t.entries[0]!.body.length < 120);
  assert.equal(t.entries[0]!.truncated, true);
  const f = buildTimeline([msg("a", "1", 1), msg("b", "2", 5)], { channelName: "c", since: 2 });
  assert.deepEqual(
    f.entries.map((e) => e.id),
    ["b"],
  );
});

test("malformed inputs do not throw; redaction stays fast on pathological text", () => {
  const t = buildTimeline(
    [
      msg("a", undefined as unknown as string, 1),
      msg("b", "ok", Number.NaN),
      msg("c", "'; DROP TABLE agora_messages;--", 2),
    ],
    { channelName: undefined as unknown as string },
  );
  assert.deepEqual(
    t.entries.map((e) => e.id),
    ["a", "c"],
  );
  const start = Date.now();
  redactSecrets("password".repeat(50_000));
  redactSecrets(`${"a:".repeat(50_000)}@`);
  assert.ok(Date.now() - start < 3000);
  // SQL text is data only: preserved literally, never interpreted.
  assert.ok(t.entries[1]!.body.includes("DROP TABLE"));
});
