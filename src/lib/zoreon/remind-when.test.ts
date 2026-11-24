// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { parseRemindWhen, resolveRemindAt } from "./remind-when.ts";

// Wed 2026-01-07 10:00:00 UTC
const NOW = Date.UTC(2026, 0, 7, 10, 0, 0);
const H = 3_600_000;

test("relative forms", () => {
  assert.equal(parseRemindWhen("30m", NOW), NOW + 30 * 60_000);
  assert.equal(parseRemindWhen("in 2 hours", NOW), NOW + 2 * H);
  assert.equal(parseRemindWhen("IN 3d", NOW), NOW + 72 * H);
  assert.equal(parseRemindWhen("1w", NOW), NOW + 168 * H);
  assert.equal(parseRemindWhen("5 parsecs", NOW), null);
});

test("clock times pick the next occurrence", () => {
  assert.equal(parseRemindWhen("at 14:30", NOW), Date.UTC(2026, 0, 7, 14, 30));
  assert.equal(parseRemindWhen("3pm", NOW), Date.UTC(2026, 0, 7, 15));
  assert.equal(parseRemindWhen("9:15am", NOW), Date.UTC(2026, 0, 8, 9, 15));
  assert.equal(parseRemindWhen("12am", NOW), Date.UTC(2026, 0, 8, 0));
  assert.equal(parseRemindWhen("25:00", NOW), null);
  assert.equal(parseRemindWhen("13pm", NOW), null);
  assert.equal(parseRemindWhen("9:61", NOW), null);
});

test("tomorrow and weekdays", () => {
  assert.equal(parseRemindWhen("tomorrow", NOW), Date.UTC(2026, 0, 8, 9));
  assert.equal(parseRemindWhen("tomorrow at 3pm", NOW), Date.UTC(2026, 0, 8, 15));
  assert.equal(parseRemindWhen("friday", NOW), Date.UTC(2026, 0, 9, 9));
  assert.equal(parseRemindWhen("next wednesday 10:00", NOW), Date.UTC(2026, 0, 14, 10));
  assert.equal(parseRemindWhen("funday", NOW), null);
});

test("timezone offset shifts clock times (UTC-5 => offset 300)", () => {
  // 10:00 UTC is 05:00 local; "3pm" local = 20:00 UTC.
  assert.equal(parseRemindWhen("3pm", NOW, 300), Date.UTC(2026, 0, 7, 20));
  // UTC+5:30 => offset -330; local is 15:30, "tomorrow" 09:00 local = 03:30 UTC on the 8th.
  assert.equal(parseRemindWhen("tomorrow", NOW, -330), Date.UTC(2026, 0, 8, 3, 30));
  assert.equal(parseRemindWhen("3pm", NOW, 99999), null);
});

test("rejects hostile input", () => {
  for (const v of [
    "",
    " ",
    "x".repeat(500),
    "9999999999999999d",
    "in -5m",
    "1; drop table",
    "\u0000",
  ]) {
    assert.equal(parseRemindWhen(v, NOW), null, v);
  }
  assert.equal(parseRemindWhen(5 as unknown as string, NOW), null);
  assert.equal(parseRemindWhen("5m", Number.NaN), null);
});

test("resolveRemindAt validates both input shapes", () => {
  assert.equal(resolveRemindAt({ when: "1h" }, NOW), NOW + H);
  assert.equal(resolveRemindAt({ remindAt: NOW + 5 * H }, NOW), NOW + 5 * H);
  assert.equal(resolveRemindAt({ when: "30m", remindAt: 1 }, NOW), NOW + 30 * 60_000);
  assert.throws(() => resolveRemindAt({ when: "gibberish" }, NOW), /Could not understand/);
  assert.throws(() => resolveRemindAt({}, NOW), /Provide remindAt or when/);
  assert.throws(() => resolveRemindAt({ remindAt: NOW - 1 }, NOW), /future/);
  assert.throws(() => resolveRemindAt({ remindAt: "soon" }, NOW), /Invalid remindAt/);
  assert.throws(() => resolveRemindAt({ remindAt: Number.NaN }, NOW), /Invalid remindAt/);
  assert.throws(() => resolveRemindAt({ remindAt: NOW + 400 * 24 * H }, NOW), /year away/);
  assert.throws(() => resolveRemindAt({ when: "9999w" }, NOW), /year away/);
});

test("bucketReminders splits overdue / today / upcoming in caller-local time", async () => {
  const { bucketReminders } = await import("./remind-when.ts");
  const rows = [
    { id: "late", remindAt: NOW - H },
    { id: "eve", remindAt: Date.UTC(2026, 0, 7, 23) },
    { id: "tom", remindAt: Date.UTC(2026, 0, 8, 1) },
    { id: "next", remindAt: NOW + 5 * 24 * H },
  ];
  const b = bucketReminders(rows, NOW, 0);
  assert.deepEqual(b.overdue.map((r) => r.id), ["late"]);
  assert.deepEqual(b.today.map((r) => r.id), ["eve"]);
  assert.deepEqual(b.upcoming.map((r) => r.id), ["tom", "next"]);
  // UTC+2 (offset -120): local day ends 22:00 UTC, so 23:00 UTC is already tomorrow.
  const b2 = bucketReminders(rows, NOW, -120);
  assert.deepEqual(b2.today.map((r) => r.id), []);
  assert.deepEqual(bucketReminders([], NOW).overdue, []);
  assert.deepEqual(bucketReminders(rows, NOW, Number.NaN).today.map((r) => r.id), ["eve"]);
});
