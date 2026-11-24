// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import type { ParsedSearch } from "./search-parse.ts";

export type SearchRow = {
  id: string;
  channel_id: string;
  body: string;
  created_at: number | string;
  author_id: string;
};

/** A DM is visible only to its members; every other channel kind is workspace-visible. */
export function canSeeChannel(
  kind: string,
  memberIdsJson: string | null | undefined,
  profileId: string | null,
): boolean {
  if (kind !== "dm") return true;
  if (!profileId) return false;
  try {
    const members: unknown = JSON.parse(memberIdsJson ?? "[]");
    return Array.isArray(members) && members.includes(profileId);
  } catch {
    return false;
  }
}

/** Apply from:/in:/before:/after:/has:link filters (case-insensitive substring for ids). */
export function applySearchFilters<T extends SearchRow>(rows: T[], p: ParsedSearch): T[] {
  let out = rows;
  if (p.inChannel) {
    const ch = p.inChannel.toLowerCase();
    out = out.filter((r) => r.channel_id.toLowerCase().includes(ch));
  }
  if (p.from) {
    const f = p.from.toLowerCase();
    out = out.filter((r) => r.author_id.toLowerCase().includes(f));
  }
  if (p.after) {
    const t = Date.parse(p.after);
    if (!Number.isNaN(t)) out = out.filter((r) => Number(r.created_at) >= t);
  }
  if (p.before) {
    const t = Date.parse(p.before);
    if (!Number.isNaN(t)) out = out.filter((r) => Number(r.created_at) <= t);
  }
  if (p.has === "link") out = out.filter((r) => /https?:\/\//i.test(r.body));
  return out;
}
