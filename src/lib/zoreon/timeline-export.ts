// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Incident timeline export (Markdown / JSON). Pure: message text is untrusted,
 * so every string is stripped of control/bidi characters, secret-redacted, and
 * (for Markdown) escaped so it cannot inject HTML, links, headings or tables.
 */

export type TimelineMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: number;
  updatedAt?: number;
  parentId?: string;
  system?: boolean;
  files?: { name: string }[];
};

export type TimelineAuthor = { name?: string; handle?: string };

export type TimelineOptions = {
  channelName: string;
  since?: number;
  until?: number;
  /** Max entries kept (later entries are dropped past the cap). */
  maxMessages?: number;
  /** Max characters kept per message body. */
  maxBodyChars?: number;
  authors?: Record<string, TimelineAuthor>;
  generatedAt?: number;
};

export const TIMELINE_MAX_MESSAGES = 5000;
export const TIMELINE_MAX_BODY_CHARS = 8000;
export const REDACTED = "[REDACTED]";

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];

/** Replace likely secrets with a marker. Bounded quantifiers only. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED);
  // scheme://user:password@host
  out = out.replace(
    /(\b[a-z][a-z0-9+.-]{0,20}:\/\/)[^\s/:@]{1,200}:[^\s/@]{1,200}@/gi,
    `$1${REDACTED}@`,
  );
  // Authorization: Bearer xxx / Basic xxx
  out = out.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,500}/g, `$1 ${REDACTED}`);
  // key=value / key: value assignments
  out = out.replace(
    /\b([A-Za-z0-9_.-]{0,40}(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)[A-Za-z0-9_.-]{0,20})(\s{0,5}[:=]\s{0,5})(?:"[^"\n]{1,300}"|'[^'\n]{1,300}'|[^\s"',;]{1,300})/gi,
    `$1$2${REDACTED}`,
  );
  return out;
}

/** Drop control chars (keep \n, \t), bidi overrides, zero-width chars and BOM. */
/* eslint-disable no-control-regex, no-irregular-whitespace */
export function stripUnsafeChars(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "");
}

/** Escape text so Markdown/HTML renderers show it literally. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}[\]()#+!|~:@-])/g, "\\$1");
}

function cap(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: `${text.slice(0, max)}… [truncated]`, truncated: true };
}

function clean(text: unknown, maxChars: number) {
  // Cap first so redaction patterns never scan a huge payload.
  const capped = cap(stripUnsafeChars(typeof text === "string" ? text : ""), maxChars * 2);
  const redacted = redactSecrets(capped.text);
  const final = cap(redacted, maxChars);
  return { text: final.text, truncated: capped.truncated || final.truncated };
}

export type TimelineEntry = {
  id: string;
  at: string;
  author: string;
  body: string;
  edited: boolean;
  parentId: string | null;
  system: boolean;
  files: string[];
  truncated: boolean;
};

export type Timeline = {
  schema: "zoreon.timeline.v1";
  channel: string;
  generatedAt: string;
  truncated: boolean;
  omitted: number;
  entries: TimelineEntry[];
};

function iso(ms: number): string {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "invalid-date";
}

export function buildTimeline(messages: TimelineMessage[], opts: TimelineOptions): Timeline {
  const maxMessages = opts.maxMessages ?? TIMELINE_MAX_MESSAGES;
  const maxBody = opts.maxBodyChars ?? TIMELINE_MAX_BODY_CHARS;
  const inRange = messages
    .filter((m) => Number.isFinite(m.createdAt))
    .filter((m) => opts.since === undefined || m.createdAt >= opts.since)
    .filter((m) => opts.until === undefined || m.createdAt <= opts.until)
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  const kept = inRange.slice(0, Math.max(0, maxMessages));
  const entries = kept.map((m): TimelineEntry => {
    const a = opts.authors?.[m.authorId];
    const authorRaw = a?.name || a?.handle || m.authorId;
    const body = clean(m.body, maxBody);
    return {
      id: clean(m.id, 100).text,
      at: iso(m.createdAt),
      author: clean(authorRaw, 100).text,
      body: body.text,
      edited: m.updatedAt !== undefined,
      parentId: m.parentId ? clean(m.parentId, 100).text : null,
      system: Boolean(m.system),
      files: (m.files ?? []).slice(0, 50).map((f) => clean(f.name, 200).text),
      truncated: body.truncated,
    };
  });
  return {
    schema: "zoreon.timeline.v1",
    channel: clean(opts.channelName, 200).text,
    generatedAt: iso(opts.generatedAt ?? Date.now()),
    truncated: inRange.length > kept.length,
    omitted: inRange.length - kept.length,
    entries,
  };
}

export function timelineToJson(t: Timeline): string {
  return JSON.stringify(t, null, 2);
}

export function timelineToMarkdown(t: Timeline): string {
  const lines: string[] = [];
  lines.push(`# Incident timeline: ${escapeMarkdown(t.channel)}`, "");
  lines.push(`Generated ${t.generatedAt}. ${t.entries.length} message(s).`);
  if (t.truncated) lines.push(`**Truncated:** ${t.omitted} later message(s) omitted.`);
  lines.push("");
  for (const e of t.entries) {
    const flags = [e.system ? "system" : "", e.edited ? "edited" : "", e.parentId ? "reply" : ""]
      .filter(Boolean)
      .join(", ");
    lines.push(`- \`${e.at}\` **${escapeMarkdown(e.author)}**${flags ? ` (${flags})` : ""}`);
    for (const l of escapeMarkdown(e.body).split("\n")) lines.push(`  > ${l}`);
    if (e.files.length) lines.push(`  > Files: ${e.files.map(escapeMarkdown).join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}
