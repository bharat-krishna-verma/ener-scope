import * as cheerio from "cheerio";
import { decrypt } from "../crypto";
import { scrapePortal, badUrl, type RawTender } from "./scraper";

/**
 * GeM (bidplus.gem.gov.in) facts, from research:
 *  - No public bid-listing API for discovery.
 *  - JS-rendered, session-based, CAPTCHA on login, rate-limited.
 * Recommended flow:
 *  1) Log in manually in Chrome (you solve CAPTCHA once).
 *  2) Open bidplus.gem.gov.in/all-bids, open DevTools > Application > Cookies,
 *     copy the whole cookie string (or export with a cookie-export extension).
 *  3) Paste it here. We validate it and scrape with your existing engine.
 *  4) When it expires (session timeout), the "Test session" button tells you,
 *     and your saved username/password (encrypted) can re-establish a session
 *     via a headless browser (Playwright) — see README "Optional Playwright".
 */
export type GemConfig = {
  gemUserEnc: string; gemPassEnc: string; gemCookieEnc: string; gemListUrl: string;
};

export function packGem(cfg: { gemUser?: string; gemPass?: string; gemSessionCookie?: string; gemListUrl?: string }): GemConfig {
  return {
    gemUserEnc: cfg.gemUser || "",
    gemPassEnc: cfg.gemPass || "",
    gemCookieEnc: cfg.gemSessionCookie || "",
    gemListUrl: cfg.gemListUrl || "https://bidplus.gem.gov.in/all-bids",
  };
}

export async function testGemSession(cfg: GemConfig): Promise<{ ok: boolean; message: string }> {
  const cookie = decrypt(cfg.gemCookieEnc);
  const listUrl = cfg.gemListUrl || "https://bidplus.gem.gov.in/all-bids";
  const err = badUrl(listUrl);
  if (err) return { ok: false, message: err };
  if (!cookie.trim()) return { ok: false, message: "No session cookie saved yet. Log in to GeM in your browser and paste your cookies (see instructions)." };
  try {
    const res = await fetch(listUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Cookie: cookie,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const html = await res.text();
    if (res.status === 401 || res.status === 403 || (/login|captcha/i.test(html.slice(0, 4000)) && /type=["']?password/i.test(html)))
      return { ok: false, message: "Session rejected (login page or CAPTCHA returned). Your GeM session likely expired — re-import fresh cookies." };
    const $ = cheerio.load(html);
    const looksLikeBids = /bid|tender/i.test($("body").text());
    return { ok: res.ok && looksLikeBids, message: res.ok ? `Session accepted by GeM (HTTP ${res.status}).` : `GeM returned HTTP ${res.status}.` };
  } catch (e) {
    return { ok: false, message: String((e as Error).message || e) };
  }
}

/** Scrape GeM bids using the saved session cookie. BidPlus rows are table-based. */
export async function scrapeGem(cfg: GemConfig, sourceName: string): Promise<RawTender[]> {
  const cookie = decrypt(cfg.gemCookieEnc);
  const listUrl = cfg.gemListUrl || "https://bidplus.gem.gov.in/all-bids";
  return scrapePortal({
    id: "gem", name: sourceName,
    listUrl,
    selectors: {
      container: "table tbody tr, .bid-cards .card, div[id*='bid']",
      title: "td:nth-child(2), .bid-title, a",
      link: "a",
      org: "td:nth-child(4), .buyer",
      published: "td:nth-child(5)",
      deadline: "td:nth-child(6), .end-date",
      value: "",
      summary: "td:nth-child(1), .bid-number",
    },
    access: { mode: "cookie", loginUrl: "", user: "", pass: "", cookie },
  });
}
