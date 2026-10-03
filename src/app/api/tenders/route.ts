import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Tender } from "@/lib/models";
import { daysLeft, sortRows, startOfToday, type TenderRow } from "@/lib/tender/pipeline";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "all";
  const q = (searchParams.get("q") || "").trim();
  const filter: any = {};
  if (scope === "today") filter.foundAt = { $gte: startOfToday() };
  if (q) filter.$or = [{ title: new RegExp(esc(q), "i") }, { summary: new RegExp(esc(q), "i") }, { org: new RegExp(esc(q), "i") }];
  const docs = await Tender.find(filter).sort({ foundAt: -1 }).limit(1000).lean();
  const rows: TenderRow[] = docs.map((d: any) => ({
    title: d.title, link: d.link, org: d.org, published: d.published, deadline: d.deadline,
    value: d.value, summary: d.summary, source: d.source, uid: d.uid, days: daysLeft(d.deadline),
    foundAt: d.foundAt ? new Date(d.foundAt).toISOString() : "",
  }));
  return NextResponse.json({ ok: true, rows: sortRows(rows, "found") });
}
