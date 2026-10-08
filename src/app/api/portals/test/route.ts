import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { scrapePortal } from "@/lib/tender/scraper";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  try {
    await dbConnect();

    const portalId = body.id || body._id || "";
    let name = body.name || "Test portal";
    let listUrl = body.listUrl || "";
    let selectors = body.selectors;
    let access = body.access;

    if (portalId) {
      // Merge with stored portal so id-only (or blank secrets) tests still work.
      const saved = (await Portal.findById(portalId).lean()) as any;
      if (!saved) {
        return NextResponse.json({ ok: false, found: 0, sample: [], error: "Portal not found." });
      }
      name = name || saved.name || "Test portal";
      listUrl = listUrl || saved.listUrl || "";
      selectors = {
        ...(saved.selectors || {}),
        ...(selectors || {}),
      };
      access = {
        mode: access?.mode ?? saved.access?.mode ?? "public",
        loginUrl: access?.loginUrl || saved.access?.loginUrl || "",
        user: access?.user || saved.access?.user || "",
        pass: access?.pass || decrypt(saved.access?.pass ?? ""),
        cookie: access?.cookie || decrypt(saved.access?.cookie ?? ""),
      };
    }

    if (!listUrl) {
      return NextResponse.json({
        ok: false,
        found: 0,
        sample: [],
        error: "Listing URL is required (or provide a saved portal id).",
      });
    }

    const rows = await scrapePortal({
      id: portalId || "test",
      name,
      listUrl,
      selectors,
      access,
    });
    return NextResponse.json({ ok: true, found: rows.length, sample: rows.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ ok: false, found: 0, sample: [], error: String((e as Error).message || e) });
  }
}
