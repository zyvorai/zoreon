// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

export type ExportRequest = {
  channelId: string;
  format: "markdown" | "json";
  since?: number;
  until?: number;
};

/** Channel ids are opaque ids (MM 26-char ids, `ch-...` locally): allow a conservative charset. */
const CHANNEL_ID = /^[A-Za-z0-9_-]{1,64}$/;

function optTime(v: unknown, name: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 8.64e15) {
    throw new Error(`Invalid ${name}: expected a millisecond timestamp`);
  }
  return Math.floor(v);
}

export function parseExportRequest(raw: unknown): ExportRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof r.channelId !== "string" || !CHANNEL_ID.test(r.channelId)) {
    throw new Error("Invalid channelId");
  }
  const format = r.format ?? "markdown";
  if (format !== "markdown" && format !== "json") throw new Error("Invalid format");
  const since = optTime(r.since, "since");
  const until = optTime(r.until, "until");
  if (since !== undefined && until !== undefined && since > until) {
    throw new Error("Invalid range: since is after until");
  }
  return { channelId: r.channelId, format, since, until };
}
