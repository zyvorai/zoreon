import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto.server";

export async function getStoredMmToken(userId: string): Promise<{
  mmUserId: string;
  token: string;
} | null> {
  const sql = await getSql();
  const rows = await sql<{ mm_user_id: string; token_cipher: string }>`
    select mm_user_id, token_cipher from agora_mm_tokens where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  try {
    return { mmUserId: row.mm_user_id, token: decryptSecret(row.token_cipher) };
  } catch {
    return null;
  }
}

export async function saveMmToken(input: {
  userId: string;
  mmUserId: string;
  token: string;
}): Promise<void> {
  const sql = await getSql();
  const cipher = encryptSecret(input.token);
  await sql`
    insert into agora_mm_tokens (user_id, mm_user_id, token_cipher, updated_at)
    values (${input.userId}, ${input.mmUserId}, ${cipher}, now())
    on conflict (user_id) do update set
      mm_user_id = excluded.mm_user_id,
      token_cipher = excluded.token_cipher,
      updated_at = now()
  `;
}

export async function deleteMmToken(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from agora_mm_tokens where user_id = ${userId}`;
}
