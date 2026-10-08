import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal } from "@/lib/models";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit")) || 20));
  const filter = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { listUrl: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
  const [items, total] = await Promise.all([
    Portal.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Portal.countDocuments(filter),
  ]);
  return NextResponse.json({ ok: true, items: items.map(redact), total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  if (!body.name?.trim() || !body.listUrl?.trim())
    return NextResponse.json({ ok: false, error: "Portal name and listing URL are required." }, { status: 400 });
  const doc = await Portal.create({
    name: body.name.trim(), listUrl: body.listUrl.trim(), enabled: body.enabled !== false,
    selectors: { ...body.selectors },
    access: {
      mode: body.access?.mode || "public",
      loginUrl: body.access?.loginUrl || "",
      user: body.access?.user || "",
      pass: encrypt(body.access?.pass || ""),
      cookie: encrypt(body.access?.cookie || ""),
    },
  });
  return NextResponse.json({ ok: true, item: redact(doc.toObject()) });
}

function redact(d: any) {
  return { ...d, access: { ...d.access, pass: d.access?.pass ? "••••••" : "", cookie: d.access?.cookie ? "••••••" : "" } };
}
