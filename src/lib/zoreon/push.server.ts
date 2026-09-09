import webpush from "web-push";
import { getSql } from "@/lib/db";

export function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  );
}

export async function sendPushToEmail(
  email: string,
  payload: { title: string; body: string },
): Promise<void> {
  if (!vapidConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  const sql = await getSql();
  const e = email.trim().toLowerCase();
  const rows = await sql<{ endpoint: string; p256dh: string; auth: string }>`
    select endpoint, p256dh, auth from agora_push_subscriptions where user_email = ${e}
  `;
  const body = JSON.stringify(payload);
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
      );
    } catch {
      await sql`delete from agora_push_subscriptions where endpoint = ${row.endpoint}`;
    }
  }
}
