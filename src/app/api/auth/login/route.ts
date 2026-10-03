import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  await dbConnect();
  const { email, password } = await req.json();
  const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
  if (!user || !verifyPassword(String(password || ""), user.passwordHash)) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }
  const token = await createSessionToken(user.email, user.role);
  const res = NextResponse.json({ ok: true, email: user.email, name: user.name, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}
