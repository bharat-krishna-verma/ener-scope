import crypto from "crypto";

const KEY = crypto
  .createHash("sha256")
  .update(process.env.AUTH_SECRET || "dev-secret-change-me")
  .digest();

export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
