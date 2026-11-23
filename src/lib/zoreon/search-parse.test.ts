// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { escapeLike, parseSearchQuery } from "./search-parse.ts";

test("escapeLike neutralises LIKE wildcards and the escape char", () => {
  assert.equal(escapeLike("100%_done\\"), "100\\%\\_done\\\\");
  assert.equal(escapeLike("'; drop table x;--"), "'; drop table x;--");
});

test("parseSearchQuery keeps hostile text as plain data", () => {
  const p = parseSearchQuery("from:bob in:#ops x' OR 1=1 --");
  assert.equal(p.from, "bob");
  assert.equal(p.inChannel, "ops");
  assert.equal(p.freeText, "x' OR 1=1 --");
});
