import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal } from "@/lib/models";
import { encrypt } from "@/lib/crypto";

type Ctx = { params: { id: string } };

export async function PUT(req: Request, { params }: Ctx) {
  await dbConnect();
  const body = await req.json();
  const current = await Portal.findById(params.id);
  if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Empty password/cookie in the payload = "keep existing".
  const access = {
    mode: body.access?.mode || current.access.mode,
    loginUrl: body.access?.loginUrl ?? current.access.loginUrl,
    user: body.access?.user ?? current.access.user,
    pass: body.access?.pass ? encrypt(body.access.pass) : current.access.pass,
    cookie: body.access?.cookie ? encrypt(body.access.cookie) : current.access.cookie,
  };
  await Portal.updateOne({ _id: params.id }, { $set: {
    name: body.name ?? current.name,
    listUrl: body.listUrl ?? current.listUrl,
    enabled: body.enabled ?? current.enabled,
    access,
    selectors: body.selectors ? { ...body.selectors } : current.selectors,
  }});
  const doc = await Portal.findById(params.id).lean();
  return NextResponse.json({ ok: true, item: doc });
}

export async function DELETE(_: Request, { params }: Ctx) {
  await dbConnect();
  await Portal.deleteOne({ _id: params.id });
  return NextResponse.json({ ok: true });
}
