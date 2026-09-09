import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";

function newToken() {
  return randomBytes(18).toString("base64url");
}

/** Ensure at least one active invite exists; return its token. */
export async function ensureActiveInvite(createdBy = "system"): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ token: string }>`
    select token from agora_invites
    where revoked_at is null
    order by created_at desc
    limit 1
  `;
  if (rows[0]?.token) return rows[0].token;
  const token = newToken();
  await sql`
    insert into agora_invites (token, created_by)
    values (${token}, ${createdBy})
  `;
  return token;
}

export async function getActiveInviteToken(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ token: string }>`
    select token from agora_invites
    where revoked_at is null
    order by created_at desc
    limit 1
  `;
  return rows[0]?.token ?? null;
}

export async function validateInviteToken(token: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const sql = await getSql();
  const rows = await sql<{ token: string }>`
    select token from agora_invites
    where token = ${trimmed} and revoked_at is null
    limit 1
  `;
  return Boolean(rows[0]);
}

export async function consumeInvite(token: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update agora_invites
    set use_count = use_count + 1
    where token = ${token.trim()} and revoked_at is null
  `;
}

/** Revoke all active invites and mint a fresh multi-use token. */
export async function regenerateInvite(createdBy: string): Promise<string> {
  const sql = await getSql();
  await sql`
    update agora_invites set revoked_at = now() where revoked_at is null
  `;
  const token = newToken();
  await sql`
    insert into agora_invites (token, created_by)
    values (${token}, ${createdBy})
  `;
  return token;
}
