// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * Parse Slack-style reminder times and validate reminder timestamps. Pure.
 * Accepted `when` forms (case-insensitive):
 *   "30m", "in 2 hours", "in 3d", "1w"        relative
 *   "at 14:30", "14:30", "3pm", "at 9:15am"   next occurrence of that clock time
 *   "tomorrow", "tomorrow 3pm"                next day, default 09:00
 *   "monday", "next friday 10:00"             next such weekday (never today), default 09:00
 * Clock times are interpreted in the caller's zone via `tzOffsetMinutes`
 * (the value of JS `Date#getTimezoneOffset()`: minutes UTC minus local).
 */

export const REMIND_MAX_AHEAD_MS = 366 * 24 * 3_600_000;
export const REMIND_MIN_AHEAD_MS = 1_000;

const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function unitOf(word: string): number | null {
  const w = word.toLowerCase();
  if (/^(m|min|mins|minute|minutes)$/.test(w)) return UNIT_MS.m;
  if (/^(h|hr|hrs|hour|hours)$/.test(w)) return UNIT_MS.h;
  if (/^(d|day|days)$/.test(w)) return UNIT_MS.d;
  if (/^(w|wk|wks|week|weeks)$/.test(w)) return UNIT_MS.w;
  return null;
}

/** Returns [hours, minutes] or null. Accepts 14:30, 9, 3pm, 9:15am. */
function clock(s: string): [number, number] | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s{0,2}(am|pm)?$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  } else if (h > 23) return null;
  return [h, min];
}

/** Resolve a `when` phrase to an epoch-ms timestamp, or null if not understood. */
export function parseRemindWhen(raw: string, now: number, tzOffsetMinutes = 0): number | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  if (!Number.isFinite(now) || !Number.isFinite(tzOffsetMinutes)) return null;
  if (Math.abs(tzOffsetMinutes) > 14 * 60) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;

  const rel = /^(?:in )?(\d{1,4}) ?([a-z]{1,7})$/.exec(s);
  const unit = rel ? unitOf(rel[2]) : null;
  if (rel && unit) return now + Number(rel[1]) * unit;

  // Work in "local wall clock as UTC" space, then shift back.
  const localNow = now - tzOffsetMinutes * 60_000;
  const startOfLocalDay = Math.floor(localNow / 86_400_000) * 86_400_000;
  const toUtc = (localMs: number) => localMs + tzOffsetMinutes * 60_000;

  const at = /^(?:at )?(\d.*)$/.exec(s);
  if (at) {
    const c = clock(at[1]);
    if (!c) return null;
    let t = startOfLocalDay + (c[0] * 60 + c[1]) * 60_000;
    if (toUtc(t) <= now) t += 86_400_000;
    return toUtc(t);
  }

  const m = /^(tomorrow|(?:next )?([a-z]{6,9}))(?: (?:at )?(.+))?$/.exec(s);
  if (!m) return null;
  const c = m[3] ? clock(m[3]) : [9, 0];
  if (!c) return null;
  let dayOffset: number;
  if (m[1] === "tomorrow") dayOffset = 1;
  else {
    const dow = DAYS.indexOf(m[2] ?? "");
    if (dow < 0) return null;
    const today = new Date(startOfLocalDay).getUTCDay();
    dayOffset = (dow - today + 7) % 7 || 7;
  }
  return toUtc(startOfLocalDay + dayOffset * 86_400_000 + (c[0] * 60 + c[1]) * 60_000);
}

/** Validate/resolve the timestamp for `addReminder`. Throws clear errors. */
export function resolveRemindAt(
  input: { remindAt?: unknown; when?: unknown; tzOffsetMinutes?: unknown },
  now: number,
): number {
  let at: number | null = null;
  if (typeof input.when === "string" && input.when.trim()) {
    const tz = input.tzOffsetMinutes === undefined ? 0 : Number(input.tzOffsetMinutes);
    at = parseRemindWhen(input.when, now, tz);
    if (at === null) {
      throw new Error(
        'Could not understand the reminder time. Try "in 30m", "3pm" or "tomorrow 9am"',
      );
    }
  } else if (input.remindAt !== undefined && input.remindAt !== null) {
    if (typeof input.remindAt !== "number" || !Number.isFinite(input.remindAt)) {
      throw new Error("Invalid remindAt: expected a millisecond timestamp");
    }
    at = Math.floor(input.remindAt);
  }
  if (at === null) throw new Error("Provide remindAt or when");
  if (at < now + REMIND_MIN_AHEAD_MS) throw new Error("Reminder time must be in the future");
  if (at > now + REMIND_MAX_AHEAD_MS) throw new Error("Reminder time is more than a year away");
  return at;
}
