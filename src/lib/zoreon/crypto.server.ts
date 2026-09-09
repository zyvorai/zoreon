import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function secretKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() || "zoreon-dev-secret-change-me";
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a Mattermost user access token for storage. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts[0] !== "v1" || parts.length !== 4) throw new Error("Invalid cipher format");
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
