// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

// Runs the real search/reminder SQL against in-memory PGlite with the real migrations.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applySearchFilters, canSeeChannel } from "./search-filter.ts";
import { escapeLike, parseSearchQuery } from "./search-parse.ts";
import { resolveRemindAt } from "./remind-when.ts";
import {
  insertReminder,
  searchMessageRows,
  selectTimelineRows,
  selectOpenReminders,
  updateReminderTime,
} from "./sql-queries.ts";

let pg: PGlite;
// Minimal stand-in for the app's `Sql` (tagged template + `.query`).
let sql: any;

before(async () => {
  pg = new PGlite({ parsers: { 20: Number } });
  await pg.waitReady;
  const dir = new URL("../../../migrations/", import.meta.url);
  const files = readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of files) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
    return (await pg.query(text, values)).rows;
  };
  sql.query = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
});
after(async () => {
  await pg.close();
});

async function seed() {
  await pg.exec("delete from agora_messages; delete from agora_channels; delete from agora_profiles;");
}

test("migrations apply cleanly and tables exist", async () => {
  const r = await pg.query("select to_regclass('agora_messages') m, to_regclass('agora_reminders') r");
  assert.ok((r.rows[0] as any).m && (r.rows[0] as any).r);
});

test("reminders: insert, list, snooze, ownership, done", async () => {
  const now = Date.now();
  const at = resolveRemindAt({ when: "in 30m" }, now);
  await insertReminder(sql, { id: "rm-1", email: "a@x.io", messageId: "m1", channelId: "c1", snippet: "hi", remindAt: at });
  await insertReminder(sql, { id: "rm-2", email: "b@x.io", messageId: "m2", channelId: "c1", snippet: "yo", remindAt: at + 5 });
  const mine = await selectOpenReminders(sql, "a@x.io");
  assert.equal(mine.length, 1);
  assert.equal(Number(mine[0].remind_at), at);
  assert.equal(mine[0].done, false);

  const later = resolveRemindAt({ when: "3h" }, now);
  const upd = await updateReminderTime(sql, "a@x.io", "rm-1", later);
  assert.equal(upd.length, 1);
  assert.equal(Number(upd[0].remind_at), later);
  // another user cannot snooze it; unknown id returns nothing
  assert.deepEqual(await updateReminderTime(sql, "b@x.io", "rm-1", later), []);
  assert.deepEqual(await updateReminderTime(sql, "a@x.io", "nope", later), []);
  await pg.query("update agora_reminders set done = true where id = 'rm-1'");
  assert.deepEqual(await updateReminderTime(sql, "a@x.io", "rm-1", later), []);
  assert.deepEqual(await selectOpenReminders(sql, "a@x.io"), []);
});

test("searchMessages SQL: wildcard escaping, DM membership, ordering", async () => {
  await seed();
  const ch = (id: string, kind: string, members: string) =>
    pg.query(
      "insert into agora_channels (id, name, kind, topic, member_ids) values ($1, $2, $3, '', $4)",
      [id, id, kind, members],
    );
  await ch("ch-ops", "channel", "[]");
  await ch("dm-1", "dm", JSON.stringify(["u1", "u2"]));
  const msg = (id: string, c: string, body: string, t: number) =>
    pg.query(
      "insert into agora_messages (id, channel_id, author_id, body, created_at) values ($1, $2, 'u1', $3, $4)",
      [id, c, body, t],
    );
  await msg("a", "ch-ops", "disk 100% full", 1);
  await msg("b", "ch-ops", "disk 100x full", 2);
  await msg("c", "ch-ops", "snake_case here", 3);
  await msg("d", "ch-ops", "snakeXcase here", 4);
  await msg("e", "dm-1", "secret disk 100% plan", 5);
  const run = async (q: string, me: string | null) => {
    const p = parseSearchQuery(q);
    const rows = await searchMessageRows(sql, `%${escapeLike((p.freeText || q).trim())}%`);
    return applySearchFilters(
      rows.filter((r) => canSeeChannel(r.kind, r.member_ids, me)),
      p,
    ).map((r) => r.id);
  };
  assert.deepEqual(await run("100%", "u1"), ["e", "a"]);
  assert.deepEqual(await run("100%", "u3"), ["a"]);
  assert.deepEqual(await run("100%", null), ["a"]);
  assert.deepEqual(await run("snake_case", "u3"), ["c"]);
  assert.deepEqual(await run("DISK", "u3"), ["b", "a"]);
  assert.deepEqual(await run("x'; drop table agora_messages; --", "u1"), []);
  assert.deepEqual(await run("DECISION", "u1"), []);
  assert.deepEqual(await run("is:note disk", "u3"), []);
  const left = await pg.query("select count(*)::int n from agora_messages");
  assert.equal((left.rows[0] as any).n, 5);
});

test("timeline SQL: range bounds, ordering, channel isolation", async () => {
  await pg.exec("delete from agora_messages; delete from agora_channels;");
  for (const id of ["t1", "t2"]) {
    await pg.query("insert into agora_channels (id, name, kind, topic, member_ids) values ($1, $1, 'channel', '', '[]')", [id]);
  }
  const ins = (id: string, c: string, at: number, parent: string | null = null) =>
    pg.query(
      "insert into agora_messages (id, channel_id, author_id, body, created_at, parent_id) values ($1, $2, 'u1', 'x', $3, $4)",
      [id, c, at, parent],
    );
  await ins("m3", "t1", 300);
  await ins("m1", "t1", 100);
  await ins("m2", "t1", 200, "m1");
  await ins("other", "t2", 150);
  const all = await selectTimelineRows(sql, "t1", undefined, undefined);
  assert.deepEqual(all.map((r) => r.id), ["m1", "m2", "m3"]);
  assert.equal(all[1].parent_id, "m1");
  assert.equal(all[0].system, false);
  assert.deepEqual((await selectTimelineRows(sql, "t1", 150, 250)).map((r) => r.id), ["m2"]);
  assert.deepEqual((await selectTimelineRows(sql, "t1", 200, undefined)).map((r) => r.id), ["m2", "m3"]);
  assert.deepEqual(await selectTimelineRows(sql, "nope", undefined, undefined), []);
});
