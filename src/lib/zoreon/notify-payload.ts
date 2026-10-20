/** pg_notify payloads are limited to 8000 bytes; never send truncated (invalid) JSON. */
export const NOTIFY_MAX_BYTES = 7900;

export function toNotifyPayload(ev: unknown): string | null {
  let s = JSON.stringify(ev);
  if (Buffer.byteLength(s) <= NOTIFY_MAX_BYTES) return s;
  if (ev && typeof ev === "object" && "preview" in ev) {
    const { preview: _preview, ...rest } = ev as Record<string, unknown>;
    s = JSON.stringify(rest);
    if (Buffer.byteLength(s) <= NOTIFY_MAX_BYTES) return s;
  }
  return null;
}
