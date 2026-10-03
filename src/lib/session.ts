import { SignJWT, jwtVerify } from "jose";

// Edge-runtime safe: jose only, no node:crypto. Middleware imports from here.
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
export const SESSION_COOKIE = "ener_scope_session";

export async function createSessionToken(email: string, role: string) {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { email: string; role: string };
  } catch {
    return null;
  }
}
