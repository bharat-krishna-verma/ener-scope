// Pure pipeline: de-dupe keys, keyword matching, dates, sorting, digest.
export function uidOf(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) h2 = (h2 * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export type RawTender = {
  title: string; link: string; org: string; published: string;
  deadline: string; value: string; summary: string; source: string;
};

export function tenderUid(t: { link?: string; title?: string; org?: string }): string {
  // Listing pages often reuse one URL for every row, so title+org+link keeps each notice distinct.
  return uidOf(`${t.title || ""}\n${t.org || ""}\n${t.link || ""}`);
}

export function matchesKeywords(
  t: RawTender,
  cfg: { keywords: string[]; excludeKeywords: string[] },
): boolean {
  const blob = `${t.title} ${t.summary} ${t.org}`.toLowerCase();
  const inc = (cfg.keywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  const exc = (cfg.excludeKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (exc.length && exc.some((k) => blob.includes(k))) return false;
  return inc.length === 0 || inc.some((k) => blob.includes(k));
}

const MON: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

export function parseDate(s: string): Date | null {
  s = String(s || "").trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/(\d{1,2})[\s\-\/.]([A-Za-z]{3})[a-z]*[\s\-\/.,]+(\d{4})/))) {
    const mo = MON[m[2].toLowerCase()];
    if (mo !== undefined) return new Date(+m[3], mo, +m[1]);
  }
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

export function daysLeft(s: string, now = new Date()): number | "" {
  const d = parseDate(s);
  if (!d || isNaN(d.getTime())) return "";
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - a.getTime()) / 864e5);
}

export type TenderRow = RawTender & { uid: string; days: number | ""; foundAt: string };

export function hydrate(t: RawTender, uid: string, now = new Date()): TenderRow {
  return { ...t, uid, days: daysLeft(t.deadline, now), foundAt: now.toISOString() };
}

const dkey = (t: { days?: number | "" }) =>
  t.days === "" || t.days == null ? 1e9 : t.days < 0 ? 1e8 - t.days : t.days;

export function sortRows<T extends { days?: number | ""; source?: string; published?: string; foundAt?: string }>(
  rows: T[], mode?: string,
): T[] {
  const pd = (t: T) => { const d = parseDate(String(t.published || "")); return d ? d.getTime() : 0; };
  return rows.sort((a, b) =>
    mode === "found" ? Date.parse(b.foundAt || "0") - Date.parse(a.foundAt || "0")
    : mode === "published" ? pd(b) - pd(a)
    : mode === "portal" ? String(a.source).localeCompare(String(b.source)) || dkey(a) - dkey(b)
    : dkey(a) - dkey(b));
}

export function composeDigest(rows: TenderRow[], tag: string) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const subject = rows.length
    ? `${tag} | ${rows.length} New Tender${rows.length === 1 ? "" : "s"} | ${today}`
    : `${tag} | No New Tenders | ${today}`;

  if (!rows.length) {
    return {
      subject,
      body: `Dear Sir/Madam,\n\nNo new tenders were identified on ${today}.\n\nPlease refer to the attached Excel file for the complete tender register.\n\nYours faithfully,\nEnerScope`,
    };
  }

  const list = rows
    .slice(0, 15)
    .map((t, i) => {
      const lines = [
        `${i + 1}. ${t.title || "Untitled tender"}`,
        `   Organisation: ${t.org || t.source || "N/A"}`,
        `   Portal: ${t.source || "N/A"}`,
        `   Closing date: ${t.deadline || "N/A"}`,
      ];
      if (t.link) lines.push(`   Link: ${t.link}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const more =
    rows.length > 15
      ? `\n\nNote: ${rows.length - 15} additional tender(s) are included in the attached Excel file.`
      : "";

  const body =
    `Dear Sir/Madam,\n\n` +
    `Please find below the details of new tenders identified on ${today}.\n\n` +
    `${list}${more}\n\n` +
    `The complete list is enclosed in the attached Excel file.\n\n` +
    `Yours faithfully,\nEnerScope`;

  return { subject, body };
}

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
