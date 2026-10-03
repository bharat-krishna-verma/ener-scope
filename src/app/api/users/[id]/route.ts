import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/lib/models";
import { hashPassword } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const body = await req.json();
  const set: Record<string, unknown> = {};
  if (body.password) set.passwordHash = hashPassword(body.password);
  if (body.name) set.name = body.name;
  if (body.role) set.role = body.role;
  await User.updateOne({ _id: params.id }, { $set: set });
  return NextResponse.json({ ok: true });
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  await User.deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true });
}
