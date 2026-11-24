// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline } from "./timeline-export.ts";
import {
  INSIGHT_MAX_ITEMS,
  csvCell,
  extractInsights,
  formatDuration,
  parseMarkerLine,
  renderExport,
  timelineToCsv,
} from "./timeline-insights.ts";
import { parseExportRequest } from "./timeline-request.ts";

const T0 = Date.UTC(2026, 0, 1, 10, 0, 0);
const m = (id: string, authorId: string, body: string, min: number, extra = {}) => ({
  id,
  authorId,
  body,
  createdAt: T0 + min * 60_000,
  ...extra,
});
const authors = { a: { name: "Ann" }, b: { name: "Bob" } };
const build = (msgs: ReturnType<typeof m>[]) =>
  buildTimeline(msgs, { channelName: "cutover", authors, generatedAt: T0 });

test("parses marker lines", () => {
  assert.deepEqual(parseMarkerLine("DECISION: roll back"), {
    kind: "decision",
    text: "roll back",
    done: false,
  });
  assert.equal(parseMarkerLine("- todo: fix dns @bob")?.kind, "followUp");
  assert.equal(parseMarkerLine("Follow-up: x")?.kind, "followUp");
  assert.equal(parseMarkerLine("- [x] done thing")?.done, true);
  assert.equal(parseMarkerLine("- [ ] open thing")?.done, false);
  assert.equal(parseMarkerLine("note:   hi")?.kind, "note");
  assert.equal(parseMarkerLine("we made a decision: later"), null);
  assert.equal(parseMarkerLine("TODO:   "), null);
  assert.equal(parseMarkerLine(""), null);
});

test("extracts decisions, follow-ups with owners, notes and summary", () => {
  const t = build([
    m("1", "a", "starting cutover", 0),
    m("2", "b", "DECISION: freeze deploys\nNOTE: dns ttl 60", 3),
    m("3", "a", "TODO: update runbook @carol\n- [x] page oncall", 4, { parentId: "2" }),
    m("4", "a", "wrap up", 63, { updatedAt: 5, files: [{ name: "a.png" }] }),
    m("5", "a", "DECISION: ignored system", 64, { system: true }),
  ]);
  const i = extractInsights(t.entries);
  assert.equal(i.decisions.length, 1);
  assert.equal(i.decisions[0].text, "freeze deploys");
  assert.equal(i.decisions[0].author, "Bob");
  assert.equal(i.notes.length, 1);
  assert.deepEqual(
    i.followUps.map((f) => [f.text, f.owner, f.done]),
    [
      ["update runbook @carol", "carol", false],
      ["page oncall", null, true],
    ],
  );
  assert.equal(i.summary.messages, 5);
  assert.equal(i.summary.humanMessages, 4);
  assert.equal(i.summary.replies, 1);
  assert.equal(i.summary.edited, 1);
  assert.equal(i.summary.files, 1);
  assert.equal(i.summary.longestGapMs, 59 * 60_000);
  assert.equal(i.summary.peakMessagesIn5Min, 3);
  assert.equal(i.summary.participants[0].author, "Ann");
});

test("caps marker items and handles empty input", () => {
  const body = Array.from({ length: 150 }, (_, k) => `TODO: item ${k}`).join("\n");
  const t = build([m("1", "a", body, 0), m("2", "a", body, 1)]);
  const i = extractInsights(t.entries);
  assert.equal(i.followUps.length, INSIGHT_MAX_ITEMS);
  assert.equal(i.omittedItems, 300 - INSIGHT_MAX_ITEMS);
  const e = extractInsights([]);
  assert.equal(e.summary.first, null);
  assert.equal(e.summary.durationMs, 0);
});

test("formatDuration", () => {
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(90 * 60_000), "1h 30m");
  assert.equal(formatDuration(25 * 3_600_000), "1d 1h");
  assert.equal(formatDuration(Number.NaN), "0m");
});

test("csv neutralises formula injection and quotes", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("+1"), `"'+1"`);
  assert.equal(csvCell('say "hi"\nnow'), `"say ""hi""\nnow"`);
  assert.equal(csvCell("plain"), `"plain"`);
  const t = build([m("1", "a", "=cmd|calc", 0)]);
  const csv = timelineToCsv(t);
  assert.match(csv, /^"at","id"/);
  assert.ok(csv.includes(`"'=cmd|calc"`));
  assert.ok(csv.endsWith("\r\n"));
});

test("renderExport: every format, highlights filter, redaction survives", () => {
  const t = build([
    m("1", "a", "chatter password=hunter2", 0),
    m("2", "b", "DECISION: go <script>alert(1)</script>", 1),
  ]);
  const md = renderExport(t, "markdown", false);
  assert.equal(md.ext, "md");
  assert.equal(md.entries, 2);
  assert.ok(!md.content.includes("hunter2"));
  const hl = renderExport(t, "markdown", true);
  assert.equal(hl.entries, 1);
  assert.ok(!hl.content.includes("chatter"));
  assert.ok(!hl.content.includes("<script>"));
  const js = renderExport(t, "json", true);
  const parsed = JSON.parse(js.content);
  assert.equal(parsed.schema, "zoreon.timeline.v1");
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.insights.decisions.length, 1);
  assert.equal(parsed.insights.summary.messages, 2);
  assert.equal(renderExport(t, "csv", false).mime, "text/csv");
  const retro = renderExport(t, "retro", true);
  assert.equal(retro.entries, 2);
  assert.match(retro.content, /## Decisions/);
  assert.match(retro.content, /## Root cause/);
  assert.ok(!retro.content.includes("<script>"));
  assert.ok(!retro.content.includes("hunter2"));
});

test("digest lists decisions and only open follow-ups", () => {
  const t = build([
    m("1", "a", "DECISION: ship it\n- [x] done one\nTODO: open one", 0),
    m("2", "b", "hello <b>x</b>", 5),
  ]);
  const d = renderExport(t, "digest", false);
  assert.equal(d.ext, "md");
  assert.match(d.content, /# Catch-up: cutover/);
  assert.match(d.content, /ship it/);
  assert.match(d.content, /Open follow-ups \(1\)/);
  assert.ok(!d.content.includes("done one"));
  assert.ok(!d.content.includes("<b>"));
  assert.equal(parseExportRequest({ channelId: "a", format: "digest" }).format, "digest");
});

test("retro lists checkboxes and owners", () => {
  const t = build([m("1", "a", "TODO: patch @bob\n- [x] closed", 0)]);
  const r = renderExport(t, "retro", false).content;
  assert.match(r, /- \[ \] patch/);
  assert.match(r, /owner: \\@bob/);
  assert.match(r, /- \[x\] closed/);
});

test("request parser accepts new formats and rejects bad highlightsOnly", () => {
  assert.equal(parseExportRequest({ channelId: "a", format: "csv" }).format, "csv");
  assert.equal(parseExportRequest({ channelId: "a", format: "retro" }).format, "retro");
  assert.equal(parseExportRequest({ channelId: "a", highlightsOnly: true }).highlightsOnly, true);
  assert.throws(
    () => parseExportRequest({ channelId: "a", highlightsOnly: "yes" }),
    /highlightsOnly/,
  );
  assert.throws(
    () => parseExportRequest({ channelId: "a", format: "__proto__" }),
    /Invalid format/,
  );
  assert.throws(() => parseExportRequest({ channelId: "a", format: ["csv"] }), /Invalid format/);
});
