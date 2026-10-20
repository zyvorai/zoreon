/** Push service says the subscription is gone for good (RFC 8030: 404 / 410). */
export function isSubscriptionGone(err: unknown): boolean {
  const code = (err as { statusCode?: unknown } | null)?.statusCode;
  return code === 404 || code === 410;
}

/** VAPID subject: explicit env, else an https app URL, else a placeholder mailto. */
export function resolveVapidSubject(env: Record<string, string | undefined>): string {
  const explicit = env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  const url = env.BETTER_AUTH_URL?.trim();
  if (url && url.startsWith("https://")) return url;
  return "mailto:noreply@zoreon.local";
}
