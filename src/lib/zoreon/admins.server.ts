import { getSql } from "@/lib/db";

/** Normalize email for admin lookups. */
export function normalizeAdminEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e || null;
}

export async function isWorkspaceAdmin(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return false;
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select email from agora_workspace_admins where email = ${normalized} limit 1
  `;
  return Boolean(rows[0]);
}

export async function ensureWorkspaceAdmin(email: string): Promise<void> {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) throw new Error("Invalid email");
  const sql = await getSql();
  await sql`
    insert into agora_workspace_admins (email)
    values (${normalized})
    on conflict (email) do nothing
  `;
}

export async function removeWorkspaceAdmin(email: string): Promise<void> {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return;
  const sql = await getSql();
  await sql`delete from agora_workspace_admins where email = ${normalized}`;
}

export async function listWorkspaceAdmins(): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select email from agora_workspace_admins order by email
  `;
  return rows.map((r) => r.email);
}

/**
 * Insert ZOREON_BOOTSTRAP_ADMIN_EMAIL into workspace admins if set.
 * Idempotent — safe on every workspace load / migrate.
 */
export async function ensureBootstrapAdminFromEnv(): Promise<string | null> {
  const normalized = normalizeAdminEmail(process.env.ZOREON_BOOTSTRAP_ADMIN_EMAIL);
  if (!normalized) return null;
  await ensureWorkspaceAdmin(normalized);
  return normalized;
}
