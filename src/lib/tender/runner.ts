import { dbConnect } from "../mongodb";
import { Portal, Source, Tender, RunLog } from "../models";
import { decrypt } from "../crypto";
import { getSettings, getEmailSettingsForSend, decryptEmailPass, type AppSettings } from "../settings";
import { hydrate, matchesKeywords, tenderUid, startOfToday, sortRows, type RawTender, type TenderRow } from "./pipeline";
import { fetchApiSource, mapPool, scrapePortal } from "./scraper";
import { packGem, scrapeGem } from "./gem";
import { buildWorkbook, withDays, resolveColumns } from "./excel";
import { sendDigestEmail } from "./mailer";

export type RunOutput = {
  dryRun: boolean;
  scrapedCount: number;
  freshCount: number;
  matchedCount: number;
  errors: string[];
  notes: string[];
  rows: TenderRow[];
  log: string;
  ranAt: string;
};

/**
 * Executes a scrape. IMPORTANT: portals are ALWAYS re-read fresh from MongoDB
 * here, so any newly added/edited portal or selector saved on the Admin tab is
 * picked up by the very next run — nothing is cached in the runner.
 */
export async function executeRun(dryRun: boolean): Promise<RunOutput> {
  await dbConnect();
  const settings: AppSettings = await getSettings();
  const log = await RunLog.create({ dryRun, startedAt: new Date(), errors: [], notes: [] });

  const [portalDocs, sourceDocs] = await Promise.all([
    Portal.find({ enabled: true, listUrl: { $ne: "" } }).lean(),
    Source.find({ enabled: true }).lean(),
  ]);

  const errors: string[] = [];
  const notes: string[] = [];
  const state: { all: TenderRow[]; fresh: TenderRow[] } = { all: [], fresh: [] };
  const now = new Date();

  /* ---- HTML portals (concurrency-limited pool of 8; safe for 1000+) ---- */
  const portalResults = await mapPool(portalDocs as any[], 8, async (doc: any) => {
    try {
      const rows = await scrapePortal({
        id: String(doc._id), name: doc.name, listUrl: doc.listUrl,
        selectors: doc.selectors,
        access: {
          mode: doc.access?.mode ?? "public",
          loginUrl: doc.access?.loginUrl ?? "",
          user: doc.access?.user ?? "",
          pass: decrypt(doc.access?.pass ?? ""),
          cookie: decrypt(doc.access?.cookie ?? ""),
        },
      });
      await Portal.updateOne({ _id: doc._id }, { $set: { lastStatus: `OK (${rows.length})`, lastCheckedAt: new Date() } });
      return { name: doc.name, rows };
    } catch (e) {
      const msg = String((e as Error).message || e);
      await Portal.updateOne({ _id: doc._id }, { $set: { lastStatus: `Error: ${msg.slice(0, 120)}`, lastCheckedAt: new Date() } });
      return { name: doc.name, rows: [] as RawTender[], error: msg };
    }
  });

  for (const r of portalResults) {
    if ((r as any).error) errors.push(`${r.name}: ${(r as any).error}`);
    else if (r.rows.length) notes.push(`${r.name}: ${r.rows.length} listing(s).`);
    await absorb(r.rows, state, settings, dryRun, now);
  }

  /* ---- External sources: GeM + generic APIs ---- */
  for (const s of sourceDocs as any[]) {
    try {
      let rows: RawTender[] = [];
      if (s.type === "gem") {
        rows = await scrapeGem(packGem(s), s.name || "GeM");
      } else if (s.type === "api") {
        rows = await fetchApiSource(
          { id: String(s._id), name: s.name, enabled: true, baseUrl: s.baseUrl, endpoint: s.endpoint, authType: s.authType, apiKey: decrypt(s.apiKey), queryParam: s.queryParam, listPath: s.listPath, fieldMap: s.fieldMap },
          settings.keywords,
        );
      }
      await Source.updateOne({ _id: s._id }, { $set: { lastStatus: `OK (${rows.length})`, lastCheckedAt: new Date() } });
      notes.push(`${s.name}: ${rows.length} listing(s).`);
      await absorb(rows, state, settings, dryRun, now);
    } catch (e) {
      const msg = String((e as Error).message || e);
      await Source.updateOne({ _id: s._id }, { $set: { lastStatus: `Error: ${msg.slice(0, 120)}`, lastCheckedAt: new Date() } });
      errors.push(`${s.name}: ${msg}`);
    }
  }

  const freshCount = state.fresh.length;
  const textLog = [
    `Scanned ${state.all.length} new listing(s). Keyword matches: ${freshCount}.`,
    dryRun ? "DRY RUN — nothing was saved to the database and no email will be sent." : `Saved ${freshCount} new tender(s) to MongoDB.`,
    ...notes,
    errors.length ? `Needs attention:\n${errors.map((x) => "  " + x).join("\n")}` : "All sources answered.",
  ].join("\n");

  await RunLog.findByIdAndUpdate(log._id, {
    $set: { finishedAt: new Date(), scrapedCount: state.all.length, freshCount, matchedToday: freshCount, errors, notes },
  });

  return {
    dryRun, scrapedCount: state.all.length, freshCount, matchedCount: freshCount,
    errors, notes,
    rows: sortRows(state.fresh, "found").slice(0, 100),
    log: textLog, ranAt: now.toISOString(),
  };
}

async function absorb(rows: RawTender[], state: { all: TenderRow[]; fresh: TenderRow[] }, settings: AppSettings, dryRun: boolean, now: Date) {
  for (const raw of rows) {
    if (!raw.title) continue;
    const uid = tenderUid(raw);
    const exists = await Tender.exists({ uid });
    if (exists) continue;
    const t = hydrate(raw, uid, now);
    state.all.push(t);
    if (!dryRun) await Tender.updateOne({ uid }, { $setOnInsert: t }, { upsert: true });
    if (matchesKeywords(raw, settings)) state.fresh.push(t);
  }
}

/* -------------------- Scheduler -------------------- */

let lastRunAt = 0;
let lastEmailDate = ""; // YYYY-MM-DD — guarantees one email per day at the defined time

export function startScheduler() {
  if ((global as any).__tsScheduler) return;
  (global as any).__tsScheduler = true;
  const tick = async () => {
    try {
      const settings = await getSettings();
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const todayKey = now.toISOString().slice(0, 10);

      // 1) Scrape on the configured interval (any number of times per day).
      if (now.getTime() - lastRunAt >= settings.runIntervalMinutes * 60_000) {
        lastRunAt = now.getTime();
        await executeRun(false);
      }

      // 2) Send the digest exactly once per day at the predefined time,
      //    regardless of how many scrape runs happened today.
      if (settings.email.enabled && hhmm === settings.emailTime && lastEmailDate !== todayKey) {
        lastEmailDate = todayKey;
        await sendDailyDigest(settings);
      }
    } catch (e) {
      console.error("[scheduler]", e);
    }
  };
  setInterval(() => void tick(), 30_000);
  void tick();
}

export async function sendDailyDigest(settings: AppSettings) {
  const since = startOfToday();
  const [todayDocs, earlierDocs] = await Promise.all([
    Tender.find({ foundAt: { $gte: since } }).lean(),
    Tender.find({ foundAt: { $lt: since } }).limit(5000).lean(),
  ]);
  const toRow = (d: any): TenderRow => ({
    title: d.title, link: d.link, org: d.org, published: d.published, deadline: d.deadline,
    value: d.value, summary: d.summary, source: d.source, uid: d.uid,
    days: "", foundAt: d.foundAt ? new Date(d.foundAt).toISOString() : "",
  });
  const today = withDays(todayDocs.map(toRow));
  const earlier = withDays(earlierDocs.map(toRow));

  if (!today.length && !settings.email.notifyEmpty) return "Skipped (nothing new today).";

  const { composeForEmail } = await import("./pipeline-extra");
  const digest = composeForEmail(today, settings.email.subjectTag);
  const wb = buildWorkbook(today, earlier, settings.excel, resolveColumns(settings.excel));
  const emailCfg = await getEmailSettingsForSend(settings.email.smtpOwner || undefined);
  const pass = decryptEmailPass(emailCfg.pass);
  if (!pass) throw new Error("Saved app password could not be decrypted. Re-save SMTP credentials on Admin → Email.");
  return sendDigestEmail(
    { ...settings.email, ...emailCfg, pass, recipients: settings.email.recipients },
    { subject: digest.subject, text: digest.body, attachment: { filename: wb.filename, content: wb.xml } },
  );
}
