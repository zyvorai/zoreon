// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  computeIncidentStatus,
  isStatusUpdate,
  openFollowUps,
  parseCadenceRequest,
} from "./status-cadence.ts";
import { extractInsights } from "./timeline-insights.ts";
import type { TimelineEntry } from "./timeline-export.ts";

const T0 = Date.UTC(2026, 0, 7, 10, 0, 0);
const min = (n: number) => new Date(T0 + n * 60_000).toISOString();
const entry = (id: string, at: number, body: string, system = false): TimelineEntry => ({
  id,
  at: min(at),
  author: "ann",
  body,
  system,
  edited: false,
  files: [],
  parentId: null,
  truncated: false,
});

test("status update marker detection", () => {
  assert.equal(isStatusUpdate(entry("a", 0, "UPDATE: db back")), true);
  assert.equal(isStatusUpdate(entry("a", 0, "- status update: mitigated")), true);
  assert.equal(isStatusUpdate(entry("a", 0, "Status: ok")), true);
  assert.equal(isStatusUpdate(entry("a", 0, "an update: nope mid-line")), false);
  assert.equal(isStatusUpdate(entry("a", 0, "UPDATE:")), false);
  assert.equal(isStatusUpdate(entry("a", 0, "UPDATE: x", true)), false);
});

test("request parsing", () => {
  assert.equal(parseCadenceRequest({ channelId: "ch-1" }).intervalMinutes, 60);
  assert.equal(parseCadenceRequest({ channelId: "ch-1", severity: "SEV1" }).intervalMinutes, 30);
  assert.equal(parseCadenceRequest({ channelId: "ch-1", intervalMinutes: 15.9 }).intervalMinutes, 15);
  assert.equal(parseCadenceRequest({ channelId: "ch-1", owner: "@Bob" }).owner, "bob");
  assert.throws(() => parseCadenceRequest({ channelId: "a b" }), /channelId/);
  assert.throws(() => parseCadenceRequest({ channelId: "c", severity: "constructor" }), /severity/);
  assert.throws(() => parseCadenceRequest({ channelId: "c", intervalMinutes: 1 }), /intervalMinutes/);
  assert.throws(() => parseCadenceRequest({ channelId: "c", intervalMinutes: "30" }), /intervalMinutes/);
  assert.throws(() => parseCadenceRequest({ channelId: "c", owner: "a b;" }), /owner/);
  assert.throws(() => parseCadenceRequest(null), /channelId/);
});

test("overdue when the last update is older than the interval", () => {
  const es = [entry("1", 0, "start"), entry("2", 10, "UPDATE: investigating"), entry("3", 50, "chatter")];
  const s = computeIncidentStatus(es, extractInsights(es), { intervalMinutes: 30 }, T0 + 50 * 60_000);
  assert.equal(s.lastUpdateAt, min(10));
  assert.equal(s.nextUpdateDueAt, min(40));
  assert.equal(s.overdue, true);
  assert.equal(s.overdueByMs, 10 * 60_000);
  assert.equal(s.lastActivityAt, min(50));
});

test("not overdue inside the window; falls back to first message", () => {
  const es = [entry("1", 0, "start")];
  const ins = extractInsights(es);
  assert.equal(computeIncidentStatus(es, ins, { intervalMinutes: 30 }, T0 + 29 * 60_000).overdue, false);
  const s = computeIncidentStatus(es, ins, { intervalMinutes: 30 }, T0 + 31 * 60_000);
  assert.equal(s.overdue, true);
  assert.equal(s.lastUpdateAt, null);
});

test("empty channel is never overdue", () => {
  const s = computeIncidentStatus([], extractInsights([]), { intervalMinutes: 5 }, T0);
  assert.equal(s.overdue, false);
  assert.equal(s.nextUpdateDueAt, null);
});

test("open follow-ups: aged, oldest first, owner filter, ticked excluded", () => {
  const es = [
    entry("1", 0, "TODO: patch @Bob\n- [x] done thing @bob"),
    entry("2", 30, "TODO: write retro"),
    entry("3", 60, "ACTION: rotate keys @bob"),
  ];
  const ins = extractInsights(es);
  const all = openFollowUps(ins, T0 + 90 * 60_000);
  assert.deepEqual(all.map((f) => f.text), ["patch @Bob", "write retro", "rotate keys @bob"]);
  assert.equal(all[0].ageMs, 90 * 60_000);
  assert.deepEqual(openFollowUps(ins, T0 + 90 * 60_000, "@BOB").map((f) => f.entryId), ["1", "3"]);
  const s = computeIncidentStatus(es, ins, { intervalMinutes: 60 }, T0 + 90 * 60_000);
  assert.equal(s.unowned, 1);
  assert.equal(s.openFollowUps.length, 3);
});
