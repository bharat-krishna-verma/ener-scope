import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Tender } from "@/lib/models";
import { getSettings } from "@/lib/settings";
import { daysLeft, startOfToday, type TenderRow } from "@/lib/tender/pipeline";
import { buildWorkbook, resolveColumns } from "@/lib/tender/excel";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  const settings = await getSettings();
  const since = startOfToday();
  const [todayDocs, earlierDocs] = await Promise.all([
    Tender.find({ foundAt: { $gte: since } }).lean(),
    Tender.find({ foundAt: { $lt: since } }).limit(5000).lean(),
  ]);
  const toRow = (d: any): TenderRow => ({
    title: d.title, link: d.link, org: d.org, published: d.published, deadline: d.deadline,
    value: d.value, summary: d.summary, source: d.source, uid: d.uid,
    days: daysLeft(d.deadline), foundAt: d.foundAt ? new Date(d.foundAt).toISOString() : "",
  });
  const wb = buildWorkbook(todayDocs.map(toRow), earlierDocs.map(toRow), settings.excel, resolveColumns(settings.excel));
  return new NextResponse(wb.xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${wb.filename}"`,
    },
  });
}
