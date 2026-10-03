import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Source } from "@/lib/models";
import { decrypt, encrypt } from "@/lib/crypto";
import { packGem, testGemSession } from "@/lib/tender/gem";

export async function GET() {
  await dbConnect();
  const doc = await Source.findOne({ type: "gem" }).lean();
  if (!doc) return NextResponse.json({ ok: true, item: null });
  const d = doc as any;
  return NextResponse.json({ ok: true, item: {
    enabled: d.enabled, gemUser: decrypt(d.gemUserEnc), gemListUrl: d.gemListUrl,
    hasPass: !!d.gemPassEnc, hasCookie: !!d.gemCookieEnc, lastStatus: d.lastStatus, lastCheckedAt: d.lastCheckedAt,
  }});
}

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  if (body.test) {
    const probe = await testGemSession(packGem({
      gemUser: "", gemPass: "", gemSessionCookie: body.gemSessionCookie || "",
      gemListUrl: body.gemListUrl || "https://bidplus.gem.gov.in/all-bids",
    }));
    return NextResponse.json(probe);
  }
  const update: Record<string, unknown> = {
    name: "GeM — Government e-Marketplace (India)", type: "gem",
    enabled: body.enabled !== false,
    gemUserEnc: encrypt(body.gemUser || ""),
    gemListUrl: body.gemListUrl || "https://bidplus.gem.gov.in/all-bids",
  };
  if (body.gemPass) update.gemPassEnc = encrypt(body.gemPass);
  if (body.gemSessionCookie) update.gemSessionCookie = encrypt(body.gemSessionCookie);
  await Source.updateOne({ type: "gem" }, { $set: update }, { upsert: true });
  return NextResponse.json({ ok: true });
}
