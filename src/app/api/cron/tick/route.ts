import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { executeRun, sendDailyDigest } from "@/lib/tender/runner";
import { Setting } from "@/lib/models";
import { dbConnect } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vercel Cron entrypoint (Hobby allows once/day).
 * Scrapes portals, then sends the digest if email is enabled.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  const ok =
    (!!secret && auth === `Bearer ${secret}`) ||
    (process.env.NODE_ENV !== "production" && req.headers.get("x-cron-debug") === "1");

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const settings = await getSettings();
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const notes: string[] = [];

    const run = await executeRun(false);
    notes.push(`scrape: fresh=${run.freshCount}, scanned=${run.scrapedCount}`);

    let emailStatus = "skipped";
    if (settings.email.enabled) {
      const stampKey = `digest-sent-${todayKey}`;
      const already = await Setting.findOne({ key: stampKey }).lean();
      if (!already) {
        emailStatus = String(await sendDailyDigest(settings));
        await Setting.updateOne(
          { key: stampKey },
          { $set: { value: { at: now.toISOString(), status: emailStatus } } },
          { upsert: true },
        );
      } else {
        emailStatus = "already-sent-today";
      }
    } else {
      emailStatus = "email-disabled";
    }

    notes.push(`email: ${emailStatus}`);
    return NextResponse.json({ ok: true, at: now.toISOString(), notes });
  } catch (e: any) {
    console.error("[cron/tick]", e);
    return NextResponse.json({ ok: false, error: e.message || "cron failed" }, { status: 500 });
  }
}
