import crypto from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { dbConnect } from "./mongodb";
import { User } from "./models";

export { SESSION_COOKIE };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return crypto.timingSafeEqual(next, prev);
}

export async function getCurrentSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session?.email) return null;
  await dbConnect();
  return User.findOne({ email: session.email.toLowerCase() });
}