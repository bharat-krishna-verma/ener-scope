import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ ok: true, keywords: s.keywords, excludeKeywords: s.excludeKeywords });
}
export async function PUT(req: Request) {
  const { keywords, excludeKeywords } = await req.json();
  const s = await saveSettings({ keywords: keywords ?? [], excludeKeywords: excludeKeywords ?? [] });
  return NextResponse.json({ ok: true, keywords: s.keywords, excludeKeywords: s.excludeKeywords });
}
