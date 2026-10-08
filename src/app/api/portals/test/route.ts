import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { scrapePortal } from "@/lib/tender/scraper";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  try {
    let access = body.access;
    if (body.id) {
      // Editing blanks secrets in the form; fall back to what is stored.
      const saved = await Portal.findById(body.id).lean();
      if (saved) {
        const s: any = saved;
        access = {
          mode: access?.mode ?? s.access?.mode ?? "public",
          loginUrl: access?.loginUrl || s.access?.loginUrl || "",
          user: access?.user || s.access?.user || "",
          pass: access?.pass || decrypt(s.access?.pass ?? ""),
          cookie: access?.cookie || decrypt(s.access?.cookie ?? ""),
        };
      }
    }
    const rows = await scrapePortal({
      id: body.id || "test", name: body.name || "Test portal", listUrl: body.listUrl,
      selectors: body.selectors, access,
    });
    return NextResponse.json({ ok: true, found: rows.length, sample: rows.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ ok: false, found: 0, sample: [], error: String((e as Error).message || e) });
  }
}
