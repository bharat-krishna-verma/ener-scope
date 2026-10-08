import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { Portal, Source, Tender, RunLog } from "@/lib/models";
import { daysLeft, startOfToday, type TenderRow } from "@/lib/tender/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();

  const since = startOfToday();

  const todayTotal = await Tender.countDocuments({});
  const overall = await Tender.countDocuments({});
  const portals = await Portal.countDocuments({});
  const sources = await Source.countDocuments({ enabled: true });

  // Avoid Mongoose .lean() union typing issues in Next production builds
  const lastRunRaw = await RunLog.findOne().sort({ createdAt: -1 }).lean().exec();
  const lastRunAt =
    lastRunRaw && !Array.isArray(lastRunRaw) && "createdAt" in lastRunRaw
      ? ((lastRunRaw as { createdAt?: Date }).createdAt ?? null)
      : null;

  const docs = (await Tender.find().sort({ foundAt: -1 }).limit(500).lean().exec()) as any[];

  const rows: TenderRow[] = docs.map((d) => ({
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
      lastRunAt,
    },
    today: rows.filter((r) => new Date(r.foundAt) >= since),
    earlier: rows.filter((r) => new Date(r.foundAt) < since),
  });
}
