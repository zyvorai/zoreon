// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Incident insights derived from an already-cleaned timeline (so text is
 * redacted and stripped): decisions, follow-ups, notes and a catch-up summary.
 * Pure. Marker syntax (line start, case-insensitive, optional bullet):
 *   DECISION: ...   DECIDED: ...
 *   TODO: ...       ACTION: ...    FOLLOW-UP: ...   - [ ] ...   - [x] ...
 *   NOTE: ...
 * The first @handle on a follow-up line is recorded as its owner.
 */

import {
  escapeMarkdown,
  timelineToMarkdown,
  type Timeline,
  type TimelineEntry,
} from "./timeline-export.ts";
import type { ExportFormat } from "./timeline-request.ts";

export const INSIGHT_MAX_ITEMS = 200;
export const INSIGHT_MAX_TEXT = 300;

export type InsightKind = "decision" | "followUp" | "note";

export type InsightItem = {
  kind: InsightKind;
  at: string;
  author: string;
  entryId: string;
  text: string;
  owner: string | null;
  /** Only meaningful for follow-ups: a ticked `- [x]` checkbox. */
  done: boolean;
};

export type Participant = { author: string; messages: number };

export type TimelineSummary = {
  messages: number;
  humanMessages: number;
  replies: number;
  edited: number;
  files: number;
  participants: Participant[];
  first: string | null;
  last: string | null;
  durationMs: number;
  /** Longest silence between two consecutive messages, in ms. */
  longestGapMs: number;
  /** Most messages seen inside any 5 minute window. */
  peakMessagesIn5Min: number;
};

export type Insights = {
  decisions: InsightItem[];
  followUps: InsightItem[];
  notes: InsightItem[];
  summary: TimelineSummary;
  /** Marker items beyond INSIGHT_MAX_ITEMS that were dropped. */
  omittedItems: number;
};

const MARKER =
  /^\s{0,8}(?:[-*+]\s+)?(?:(decision|decided|todo|action|follow[- ]?up|note)\s{0,3}:\s{0,3}|\[( |x|X)\]\s{1,4})(.{1,1000})/i;

function kindOf(word: string | undefined): InsightKind {
  const w = (word ?? "todo").toLowerCase();
  if (w === "decision" || w === "decided") return "decision";
  if (w === "note") return "note";
  return "followUp";
}

export function parseMarkerLine(
  line: string,
): { kind: InsightKind; text: string; done: boolean } | null {
  const m = MARKER.exec(line);
  if (!m) return null;
  const text = m[3].trim().slice(0, INSIGHT_MAX_TEXT);
  if (!text) return null;
  if (m[2] !== undefined) return { kind: "followUp", text, done: m[2] !== " " };
  return { kind: kindOf(m[1]), text, done: false };
}

const OWNER = /(?:^|[\s(])@([A-Za-z0-9][A-Za-z0-9._-]{0,63})/;

/** Entries that carry at least one marker line. */
export function entryHasMarker(e: TimelineEntry): boolean {
  if (e.system) return false;
  return e.body
    .split("\n")
    .slice(0, 200)
    .some((l) => parseMarkerLine(l) !== null);
}

export function computeSummary(entries: TimelineEntry[]): TimelineSummary {
  const times = entries.map((e) => Date.parse(e.at)).filter((t) => Number.isFinite(t));
  times.sort((a, b) => a - b);
  let longestGap = 0;
  for (let i = 1; i < times.length; i++) longestGap = Math.max(longestGap, times[i] - times[i - 1]);
  let peak = 0;
  let lo = 0;
  for (let hi = 0; hi < times.length; hi++) {
    while (times[hi] - times[lo] > 5 * 60_000) lo++;
    peak = Math.max(peak, hi - lo + 1);
  }
  const counts = new Map<string, number>();
  for (const e of entries) if (!e.system) counts.set(e.author, (counts.get(e.author) ?? 0) + 1);
  const participants = [...counts.entries()]
    .map(([author, messages]) => ({ author, messages }))
    .sort((a, b) => b.messages - a.messages || (a.author < b.author ? -1 : 1))
    .slice(0, 20);
  return {
    messages: entries.length,
    humanMessages: entries.filter((e) => !e.system).length,
    replies: entries.filter((e) => e.parentId).length,
    edited: entries.filter((e) => e.edited).length,
    files: entries.reduce((n, e) => n + e.files.length, 0),
    participants,
    first: times.length ? new Date(times[0]).toISOString() : null,
    last: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    durationMs: times.length ? times[times.length - 1] - times[0] : 0,
    longestGapMs: longestGap,
    peakMessagesIn5Min: peak,
  };
}

export function extractInsights(entries: TimelineEntry[]): Insights {
  const decisions: InsightItem[] = [];
  const followUps: InsightItem[] = [];
  const notes: InsightItem[] = [];
  let total = 0;
  let omitted = 0;
  for (const e of entries) {
    if (e.system) continue;
    for (const line of e.body.split("\n").slice(0, 200)) {
      const p = parseMarkerLine(line);
      if (!p) continue;
      total++;
      if (total > INSIGHT_MAX_ITEMS) {
        omitted++;
        continue;
      }
      const item: InsightItem = {
        kind: p.kind,
        at: e.at,
        author: e.author,
        entryId: e.id,
        text: p.text,
        owner: p.kind === "followUp" ? (OWNER.exec(p.text)?.[1] ?? null) : null,
        done: p.done,
      };
      (p.kind === "decision" ? decisions : p.kind === "note" ? notes : followUps).push(item);
    }
  }
  return { decisions, followUps, notes, summary: computeSummary(entries), omittedItems: omitted };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const mins = Math.round(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return [d ? `${d}d` : "", h ? `${h}h` : "", m || (!d && !h) ? `${m}m` : ""]
    .filter(Boolean)
    .join(" ");
}

/** Quote one CSV cell; neutralise spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(v: string | number | boolean): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `\x27${s}`;
  return `"${s.replace(/"/g, `""`)}"`;
}

export function timelineToCsv(t: Timeline): string {
  const rows = [["at", "id", "author", "parent_id", "system", "edited", "files", "body"]];
  for (const e of t.entries) {
    rows.push([
      e.at,
      e.id,
      e.author,
      e.parentId ?? "",
      String(e.system),
      String(e.edited),
      e.files.join("; "),
      e.body,
    ]);
  }
  return `${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Keep only entries that carry decision / follow-up / note markers. */
export function highlightsOnly(t: Timeline): Timeline {
  const entries = t.entries.filter(entryHasMarker);
  return { ...t, entries };
}

export function timelineToJsonWithInsights(t: Timeline, i: Insights): string {
  return JSON.stringify({ ...t, insights: i }, null, 2);
}

function itemLines(items: InsightItem[], checkbox: boolean): string[] {
  if (!items.length) return ["_None recorded._"];
  return items.map((i) => {
    const box = checkbox ? (i.done ? "[x] " : "[ ] ") : "";
    const owner = i.owner ? ` (owner: ${escapeMarkdown(`@${i.owner}`)})` : "";
    return `- ${box}${escapeMarkdown(i.text)}${owner} (${escapeMarkdown(i.author)}, \`${i.at}\`)`;
  });
}

/** Post-incident review skeleton pre-filled from the channel (Markdown, escaped). */
export function timelineToRetro(t: Timeline, i: Insights): string {
  const s = i.summary;
  const L: string[] = [];
  L.push(`# Incident review: ${escapeMarkdown(t.channel)}`, "");
  L.push(`Generated ${t.generatedAt} from the channel record. Review before sharing.`, "");
  L.push("## Summary", "");
  L.push(`- Started: ${s.first ?? "n/a"}`);
  L.push(`- Last message: ${s.last ?? "n/a"}`);
  L.push(`- Duration: ${formatDuration(s.durationMs)}`);
  L.push(`- Messages: ${s.messages} (${s.humanMessages} from people, ${s.replies} replies)`);
  L.push(`- Busiest 5 minutes: ${s.peakMessagesIn5Min} message(s)`);
  L.push(`- Longest quiet gap: ${formatDuration(s.longestGapMs)}`);
  if (t.truncated) L.push(`- **Truncated:** ${t.omitted} later message(s) omitted.`);
  L.push("", "## Participants", "");
  if (s.participants.length) {
    for (const p of s.participants) L.push(`- ${escapeMarkdown(p.author)}: ${p.messages}`);
  } else L.push("_None._");
  L.push("", "## Decisions", "", ...itemLines(i.decisions, false));
  L.push("", "## Follow-ups", "", ...itemLines(i.followUps, true));
  L.push("", "## Notes", "", ...itemLines(i.notes, false));
  if (i.omittedItems) L.push("", `**${i.omittedItems} more marker line(s) omitted.**`);
  L.push("", "## Root cause", "", "_To be filled in._");
  L.push("", "## What went well", "", "_To be filled in._");
  L.push("", "## What to improve", "", "_To be filled in._", "");
  return L.join("\n");
}

const FORMAT_META: Record<ExportFormat, { ext: string; mime: string }> = {
  markdown: { ext: "md", mime: "text/markdown" },
  json: { ext: "json", mime: "application/json" },
  csv: { ext: "csv", mime: "text/csv" },
  retro: { ext: "md", mime: "text/markdown" },
  digest: { ext: "md", mime: "text/markdown" },
};

/** Render a built timeline in the requested format. Insights always see the full range. */
export function renderExport(t: Timeline, format: ExportFormat, only: boolean) {
  const insights = extractInsights(t.entries);
  const out = only ? highlightsOnly(t) : t;
  const content =
    format === "json"
      ? timelineToJsonWithInsights(out, insights)
      : format === "csv"
        ? timelineToCsv(out)
        : format === "retro"
          ? timelineToRetro(t, insights)
          : format === "digest"
            ? timelineToDigest(t, insights)
            : timelineToMarkdown(out);
  return {
    ...FORMAT_META[format],
    content,
    entries: format === "retro" || format === "digest" ? t.entries.length : out.entries.length,
  };
}

/** Short catch-up brief: what happened, what was decided, what is still open. */
export function timelineToDigest(t: Timeline, i: Insights): string {
  const s = i.summary;
  const open = i.followUps.filter((f) => !f.done);
  const L: string[] = [];
  L.push(`# Catch-up: ${escapeMarkdown(t.channel)}`, "");
  L.push(
    `${s.humanMessages} message(s) from ${s.participants.length} participant(s) over ${formatDuration(s.durationMs)}` +
      (s.last ? `, last activity ${s.last}.` : "."),
  );
  if (t.truncated) L.push(`**Truncated:** ${t.omitted} later message(s) omitted.`);
  if (s.participants.length) {
    L.push(
      "",
      `Most active: ${s.participants
        .slice(0, 3)
        .map((p) => `${escapeMarkdown(p.author)} (${p.messages})`)
        .join(", ")}`,
    );
  }
  L.push("", "## Decisions", "", ...itemLines(i.decisions, false));
  L.push("", `## Open follow-ups (${open.length})`, "", ...itemLines(open, true));
  L.push("", "## Notes", "", ...itemLines(i.notes, false), "");
  return L.join("\n");
}
