import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal, Source, Tender, RunLog } from "@/lib/models";
import { daysLeft, startOfToday, type TenderRow } from "@/lib/tender/pipeline";

export async function GET() {
  await dbConnect();

  const since = startOfToday();

  const [todayTotal, overall, portals, sources, lastRun] =
    await Promise.all([
      Tender.countDocuments({}),
      Tender.countDocuments({}),
      Portal.countDocuments({}),
      Source.countDocuments({ enabled: true }),
      RunLog.findOne()
        .sort({ createdAt: -1 })
        .lean<{ createdAt?: Date }>(),
    ]);

  const docs = await Tender.find()
    .sort({ foundAt: -1 })
    .limit(500)
    .lean();

  const rows: TenderRow[] = docs.map((d: any) => ({
    title: d.title,
    link: d.link,
    org: d.org,
    published: d.published,
    deadline: d.deadline,
    value: d.value,
    summary: d.summary,
    source: d.source,
    uid: d.uid,
    days: daysLeft(d.deadline),
    foundAt: d.foundAt ? new Date(d.foundAt).toISOString() : "",
  }));

  return NextResponse.json({
    ok: true,
    analytics: {
      todayTotal,
      overall,
      portals,
      sources,
      lastRunAt: lastRun?.createdAt ?? null,
    },
    today: rows.filter((r) => new Date(r.foundAt) >= since),
    earlier: rows.filter((r) => new Date(r.foundAt) < since),
  });
}