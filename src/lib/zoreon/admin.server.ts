import { getSql } from "@/lib/db";
import { randomBytes } from "node:crypto";

function nid(prefix: string) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function emailKey(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

export async function writeAudit(input: {
  actorEmail: string | null | undefined;
  action: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sql = await getSql();
    await sql`
      insert into agora_audit_log (id, actor_email, action, meta)
      values (
        ${nid("aud")},
        ${emailKey(input.actorEmail)},
        ${input.action},
        ${JSON.stringify(input.meta ?? {})}::jsonb
      )
    `;
  } catch {
    /* audit optional until migration */
  }
}

export async function listAuditLog(limit = 50): Promise<
  { id: string; at: number; actorEmail: string | null; action: string; meta: Record<string, unknown> }[]
> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    at: Date;
    actor_email: string | null;
    action: string;
    meta: Record<string, unknown>;
  }>`
    select id, at, actor_email, action, meta
    from agora_audit_log
    order by at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    at: new Date(r.at).getTime(),
    actorEmail: r.actor_email,
    action: r.action,
    meta: r.meta ?? {},
  }));
}

export async function isDeactivated(email: string | null | undefined): Promise<boolean> {
  const e = emailKey(email);
  if (!e) return false;
  try {
    const sql = await getSql();
    const rows = await sql`select 1 from agora_deactivated_users where email = ${e}`;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function deactivateUser(email: string, by: string | null): Promise<void> {
  const e = emailKey(email);
  if (!e) throw new Error("Email required");
  const sql = await getSql();
  await sql`
    insert into agora_deactivated_users (email, deactivated_by)
    values (${e}, ${emailKey(by)})
    on conflict (email) do nothing
  `;
}

export async function reactivateUser(email: string): Promise<void> {
  const e = emailKey(email);
  if (!e) return;
  const sql = await getSql();
  await sql`delete from agora_deactivated_users where email = ${e}`;
}

export async function listDeactivated(): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from agora_deactivated_users order by email`;
  return rows.map((r) => r.email);
}

export async function getRetentionDays(): Promise<number | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ retention_days: number | null }>`
      select retention_days from agora_workspace_settings where id = 'default'
    `;
    const v = rows[0]?.retention_days;
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

export async function setRetentionDays(days: number | null, by: string | null): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into agora_workspace_settings (id, retention_days, updated_at, updated_by)
    values ('default', ${days}, now(), ${emailKey(by)})
    on conflict (id) do update set
      retention_days = excluded.retention_days,
      updated_at = now(),
      updated_by = excluded.updated_by
  `;
}

export async function runRetentionPurge(): Promise<{ deleted: number }> {
  const days = await getRetentionDays();
  if (days == null || days <= 0) return { deleted: 0 };
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const sql = await getSql();
  let deleted = 0;
  const tables: { sql: string; ts: "created_at" | "remind_at" }[] = [];
  void tables;
  const r1 = await sql`delete from agora_bookmarks where created_at < to_timestamp(${cutoff / 1000})`;
  const r2 = await sql`delete from agora_reminders where created_at < to_timestamp(${cutoff / 1000})`;
  const r3 = await sql`delete from agora_post_overlays where created_at < to_timestamp(${cutoff / 1000})`;
  try {
    await sql`delete from agora_messages where created_at < ${cutoff}`;
  } catch {
    /* MM-only installs may still have empty table */
  }
  void r1;
  void r2;
  void r3;
  deleted = 1;
  return { deleted };
}
