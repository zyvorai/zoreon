// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Incident status cadence and open follow-up tracking. Pure.
 *
 * - A "status update" is a message with a line `UPDATE: ...` or `STATUS: ...`.
 * - The channel owes the next update `interval` after the last one (or after
 *   the first message when none was posted). Severity presets follow the
 *   common practice of SEV1 every 30 minutes (Rootly best practices,
 *   incident.io heartbeat nudges, Mattermost Playbooks status-update timers).
 * - Open follow-ups are aged and can be filtered by owner (FireHydrant
 *   follow-ups, Rootly action items, Mattermost Playbooks overdue tasks).
 */

import type { TimelineEntry } from "./timeline-export.ts";
import type { InsightItem, Insights } from "./timeline-insights.ts";

export const SEVERITY_INTERVAL_MIN: Record<string, number> = { sev1: 30, sev2: 60, sev3: 240 };
export const CADENCE_MIN_MINUTES = 5;
export const CADENCE_MAX_MINUTES = 7 * 24 * 60;
export const DEFAULT_INTERVAL_MIN = 60;

const UPDATE_LINE = /^\s{0,8}(?:[-*+]\s+)?(?:status(?:\s+update)?|update)\s{0,3}:\s{0,3}\S/i;

export function hasUpdateMarker(line: string): boolean {
  return UPDATE_LINE.test(line);
}

export function isStatusUpdate(e: TimelineEntry): boolean {
  if (e.system) return false;
  return e.body.split("\n").slice(0, 200).some(hasUpdateMarker);
}

export type CadenceRequest = {
  channelId: string;
  intervalMinutes: number;
  /** Only follow-ups owned by this handle (case-insensitive, leading @ ignored). */
  owner?: string;
};

const CHANNEL_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Validate untrusted input. `severity` ("sev1".."sev3") or `intervalMinutes` (5..10080). */
export function parseCadenceRequest(raw: unknown): CadenceRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof r.channelId !== "string" || !CHANNEL_ID.test(r.channelId)) {
    throw new Error("Invalid channelId");
  }
  let interval = DEFAULT_INTERVAL_MIN;
  if (r.intervalMinutes !== undefined && r.intervalMinutes !== null) {
    const n = r.intervalMinutes;
    if (typeof n !== "number" || !Number.isFinite(n) || n < CADENCE_MIN_MINUTES || n > CADENCE_MAX_MINUTES) {
      throw new Error(`Invalid intervalMinutes: expected ${CADENCE_MIN_MINUTES}..${CADENCE_MAX_MINUTES}`);
    }
    interval = Math.floor(n);
  } else if (r.severity !== undefined && r.severity !== null) {
    const key = typeof r.severity === "string" ? r.severity.toLowerCase() : "";
    if (!Object.hasOwn(SEVERITY_INTERVAL_MIN, key)) throw new Error("Invalid severity: use sev1, sev2 or sev3");
    interval = SEVERITY_INTERVAL_MIN[key];
  }
  let owner: string | undefined;
  if (r.owner !== undefined && r.owner !== null && r.owner !== "") {
    if (typeof r.owner !== "string") throw new Error("Invalid owner");
    owner = r.owner.replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(owner)) throw new Error("Invalid owner");
  }
  return { channelId: r.channelId, intervalMinutes: interval, owner };
}

export type AgedFollowUp = InsightItem & { ageMs: number };

/** Open (unticked) follow-ups, oldest first, optionally for one owner. */
export function openFollowUps(i: Insights, now: number, owner?: string): AgedFollowUp[] {
  const o = owner?.replace(/^@/, "").toLowerCase();
  return i.followUps
    .filter((f) => !f.done && (!o || f.owner?.toLowerCase() === o))
    .map((f) => ({ ...f, ageMs: Math.max(0, now - Date.parse(f.at)) }))
    .sort((a, b) => b.ageMs - a.ageMs);
}

export type IncidentStatus = {
  intervalMinutes: number;
  lastUpdateAt: string | null;
  lastUpdateBy: string | null;
  lastActivityAt: string | null;
  /** ISO time the next status update is due; null for an empty channel. */
  nextUpdateDueAt: string | null;
  overdue: boolean;
  overdueByMs: number;
  openFollowUps: AgedFollowUp[];
  unowned: number;
  decisions: number;
};

export function computeIncidentStatus(
  entries: TimelineEntry[],
  insights: Insights,
  req: Pick<CadenceRequest, "intervalMinutes" | "owner">,
  now: number,
): IncidentStatus {
  const intervalMs = req.intervalMinutes * 60_000;
  const human = entries.filter((e) => !e.system && Number.isFinite(Date.parse(e.at)));
  let lastUpdate: TimelineEntry | null = null;
  for (const e of human) {
    if (isStatusUpdate(e) && (!lastUpdate || Date.parse(e.at) >= Date.parse(lastUpdate.at))) lastUpdate = e;
  }
  let lastActivity: number | null = null;
  let first: number | null = null;
  for (const e of human) {
    const t = Date.parse(e.at);
    if (lastActivity === null || t > lastActivity) lastActivity = t;
    if (first === null || t < first) first = t;
  }
  const base = lastUpdate ? Date.parse(lastUpdate.at) : first;
  const due = base === null ? null : base + intervalMs;
  const overdueByMs = due !== null && now > due ? now - due : 0;
  const open = openFollowUps(insights, now, req.owner);
  return {
    intervalMinutes: req.intervalMinutes,
    lastUpdateAt: lastUpdate?.at ?? null,
    lastUpdateBy: lastUpdate?.author ?? null,
    lastActivityAt: lastActivity === null ? null : new Date(lastActivity).toISOString(),
    nextUpdateDueAt: due === null ? null : new Date(due).toISOString(),
    overdue: overdueByMs > 0,
    overdueByMs,
    openFollowUps: open,
    unowned: open.filter((f) => !f.owner).length,
    decisions: insights.decisions.length,
  };
}
