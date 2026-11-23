// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { parseExportRequest } from "./timeline-request.ts";

test("accepts a valid request with defaults", () => {
  assert.deepEqual(parseExportRequest({ channelId: "ch-cutover" }), {
    channelId: "ch-cutover",
    format: "markdown",
    since: undefined,
    until: undefined,
  });
});

test("rejects hostile channel ids (SQL / path / oversized)", () => {
  for (const id of [
    "x'; drop table agora_messages;--",
    "../../etc",
    "a b",
    "",
    "x".repeat(65),
    5,
    null,
    {},
  ]) {
    assert.throws(() => parseExportRequest({ channelId: id }), /Invalid channelId/);
  }
});

test("rejects bad format, times and ranges", () => {
  assert.throws(() => parseExportRequest({ channelId: "a", format: "html" }), /Invalid format/);
  assert.throws(() => parseExportRequest({ channelId: "a", since: "1; drop" }), /Invalid since/);
  assert.throws(() => parseExportRequest({ channelId: "a", until: Number.NaN }), /Invalid until/);
  assert.throws(() => parseExportRequest({ channelId: "a", since: -1 }), /Invalid since/);
  assert.throws(
    () => parseExportRequest({ channelId: "a", since: 5, until: 1 }),
    /since is after until/,
  );
  assert.throws(() => parseExportRequest(null), /Invalid channelId/);
});
