import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  const users = await User.find().select("email name role createdAt").lean();
  return NextResponse.json({ ok: true, items: users });
}
export async function POST(req: Request) {
  await dbConnect();
  const { email, name, password, role } = await req.json();
  if (!email || !password) return NextResponse.json({ ok: false, error: "Email and password required." }, { status: 400 });
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return NextResponse.json({ ok: false, error: "User already exists." }, { status: 409 });
  const doc = await User.create({ email: String(email).toLowerCase(), name: name || email, role: role === "admin" ? "admin" : "user", passwordHash: hashPassword(password) });
  return NextResponse.json({ ok: true, item: { email: doc.email, name: doc.name, role: doc.role } });
}
