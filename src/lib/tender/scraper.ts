import * as cheerio from "cheerio";
import type { RawTender } from "./pipeline";

/** Realistic browser headers — reduces bot fingerprinting and improves success rate. */
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

export type PortalForScrape = {
  id: string;
  name: string;
  listUrl: string;
  selectors: {
    container: string;
    title: string;
    link: string;
    org: string;
    published: string;
    deadline: string;
    value: string;
    summary: string;
  };
  access: {
    mode: "public" | "login" | "cookie";
    loginUrl: string;
    user: string;
    pass: string;
    cookie: string;
  };
};

export type ApiSourceForScrape = {
  id: string;
  name: string;
  enabled: boolean;
  baseUrl: string;
  endpoint: string;
  authType: "none" | "apikey" | "bearer";
  apiKey: string;
  queryParam: string;
  listPath: string;
  fieldMap: {
    title: string;
    link: string;
    org: string;
    published: string;
    deadline: string;
    value: string;
    summary: string;
  };
};

const DEFAULT_SELECTORS: PortalForScrape["selectors"] = {
  container: "table tbody tr",
  title: "",
  link: "a",
  org: "",
  published: "",
  deadline: "",
  value: "",
  summary: "",
};

/** SSRF + protocol guard used on every outbound URL. */
export function badUrl(u: string | undefined): string {
  if (!/^https?:\/\/\S+/i.test(u || "")) return "The URL must start with http:// or https://";
  if (
    /^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(
      u || "",
    )
  )
    return "Private or local addresses are not allowed";
  return "";
}

function cookieHeader(sc: string[] | undefined): string {
  return (sc || []).map((c) => c.split(";")[0]).join("; ");
}

/** Sleep helper for politeness delays and backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch with retries + exponential backoff.
 * Industry standard: retry transient failures (network, 429, 5xx) up to 3 times.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  maxAttempts = 3,
): Promise<Response> {
  const { timeoutMs = 20000, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Retry on rate-limit or server errors
      if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const delay = retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** (attempt - 1);
        await sleep(Math.min(delay, 8000));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function signIn(site: PortalForScrape): Promise<string> {
  const a = site.access;
  const first = await fetchWithRetry(a.loginUrl, {
    headers: HEADERS,
    redirect: "follow",
    timeoutMs: 20000,
  });
  const html = await first.text();
  if (/captcha|recaptcha|hcaptcha|cloudflare/i.test(html))
    throw new Error(
      'the login page shows a CAPTCHA / bot-check, so automatic sign-in cannot work. Switch this portal to "Saved session (cookie)".',
    );
  const $ = cheerio.load(html);
  const pw = $("input[type=password]").first();
  if (!pw.length) throw new Error("no password box found at the login page URL");
  const form = pw.closest("form");
  const scope = form.length ? form : $("body");
  const fields: Record<string, string> = {};
  scope.find("input[name]").each((_, el) => {
    if (($(el).attr("type") || "").toLowerCase() === "hidden")
      fields[$(el).attr("name")!] = $(el).attr("value") || "";
  });
  const inputs = scope.find("input[name]").toArray();
  const pi = inputs.indexOf(pw.get(0) as (typeof inputs)[number]);
  let userField = "";
  for (let i = pi - 1; i >= 0 && !userField; i--) {
    const t = ($(inputs[i]).attr("type") || "").toLowerCase();
    if (["text", "email", "tel", ""].includes(t)) userField = $(inputs[i]).attr("name") || "";
  }
  if (!userField) throw new Error("no username box found at the login page URL");
  fields[userField] = a.user || "";
  fields[pw.attr("name")!] = a.pass || "";
  const action = new URL(form.attr("action") || a.loginUrl, a.loginUrl).toString();
  const err = badUrl(action);
  if (err) throw new Error(err);
  const jar0 = cookieHeader(first.headers.getSetCookie?.() ?? []);
  const r = await fetchWithRetry(action, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar0,
      Referer: a.loginUrl,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
    timeoutMs: 20000,
  });
  const body = await r.text();
  if (r.status === 200 && /type=["']?password/i.test(body))
    throw new Error("sign-in failed. Check the username and password");
  const jar1 = cookieHeader(r.headers.getSetCookie?.() ?? []);
  return [jar0, jar1].filter(Boolean).join("; ");
}

/**
 * Scrape a single HTML portal listing page.
 * - Applies defensive defaults so partial portal docs never crash a run.
 * - Resolves relative links against listUrl.
 * - Detects expired sessions when a login form is returned instead of rows.
 */
export async function scrapePortal(site: PortalForScrape): Promise<RawTender[]> {
  const s: PortalForScrape["selectors"] = { ...DEFAULT_SELECTORS, ...(site.selectors || {}) };
  const a: PortalForScrape["access"] = Object.assign(
    {
      mode: "public" as const,
      loginUrl: "",
      user: "",
      pass: "",
      cookie: "",
    },
    site.access || {},
  );

  const err = badUrl(site.listUrl) || (a.mode === "login" ? badUrl(a.loginUrl) : "");
  if (err) throw new Error(err);

  let cookie = "";
  if (a.mode === "login") cookie = await signIn({ ...site, selectors: s, access: a });
  else if (a.mode === "cookie") {
    cookie = a.cookie;
    if (!cookie.trim()) throw new Error("no saved session cookie. Paste one from your browser.");
  }
  const headers: Record<string, string> = { ...HEADERS };
  if (cookie) headers.Cookie = cookie;

  // Small politeness delay (50–150 ms) so concurrent workers don't hammer the same host
  await sleep(50 + Math.floor(Math.random() * 100));

  const res = await fetchWithRetry(site.listUrl, {
    headers,
    redirect: "follow",
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from the listing page`);
  const html = await res.text();

  // Early bot-wall / challenge detection
  if (
    /just a moment|checking your browser|cf-browser-verification|attention required/i.test(
      html.slice(0, 3000),
    )
  ) {
    throw new Error(
      "site returned a bot-check / Cloudflare challenge. Use a saved session cookie or try later.",
    );
  }

  const $ = cheerio.load(html);
  const rows: RawTender[] = [];
  $(s.container || "tr").each((_, card) => {
    const title = s.title
      ? $(card).find(s.title).first().text().trim().replace(/\s+/g, " ")
      : "";
    let link = "";
    if (s.link) {
      const href = $(card).find(s.link).first().attr("href");
      if (href) {
        try {
          link = new URL(href, site.listUrl).toString();
        } catch {
          link = "";
        }
      }
    }
    const txt = (sel?: string) =>
      sel ? $(card).find(sel).first().text().trim().replace(/\s+/g, " ") : "";
    if (title) {
      rows.push({
        title,
        link,
        org: txt(s.org) || site.name,
        published: txt(s.published),
        deadline: txt(s.deadline),
        value: txt(s.value),
        summary: txt(s.summary),
        source: site.name,
      });
    }
  });
  if (!rows.length && a.mode !== "public" && /type=["']?password/i.test(html)) {
    throw new Error(
      a.mode === "cookie"
        ? "session expired. Paste a fresh cookie"
        : "sign-in did not last. Check the details",
    );
  }
  return rows;
}

function dig(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return String(path)
    .split(".")
    .reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

/** Generic JSON API source scraper. */
export async function fetchApiSource(
  src: ApiSourceForScrape,
  keywords: string[],
): Promise<RawTender[]> {
  const err = badUrl(src.baseUrl);
  if (err) throw new Error(err);
  const kw = keywords.join(",");
  const base = (src.baseUrl || "").replace(/\/+$/, "");
  const path = (src.endpoint || "").replace(/^\/+/, "");
  const url = new URL(path ? `${base}/${path}` : base);
  if (src.queryParam && kw) url.searchParams.set(src.queryParam, kw);
  if (badUrl(url.toString())) throw new Error("API URL is not allowed");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": HEADERS["User-Agent"],
  };
  if (src.authType === "bearer" && src.apiKey) headers.Authorization = `Bearer ${src.apiKey}`;
  if (src.authType === "apikey" && src.apiKey) headers["X-API-KEY"] = src.apiKey;

  await sleep(50 + Math.floor(Math.random() * 100));

  const res = await fetchWithRetry(url.toString(), {
    headers,
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from the API`);
  const data: unknown = await res.json();
  let list = src.listPath ? dig(data, src.listPath) : data;
  if (
    list &&
    !Array.isArray(list) &&
    typeof list === "object" &&
    Array.isArray((list as { items?: unknown[] }).items)
  )
    list = (list as { items: unknown[] }).items;
  if (!Array.isArray(list)) list = [];
  const fm = src.fieldMap;
  const S = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  return (list as unknown[])
    .map((item) => ({
      title: S(dig(item, fm.title)),
      link: S(dig(item, fm.link)),
      org: S(dig(item, fm.org)) || src.name,
      published: S(dig(item, fm.published)),
      deadline: S(dig(item, fm.deadline)),
      value: S(dig(item, fm.value)),
      summary: S(dig(item, fm.summary)),
      source: src.name,
    }))
    .filter((t) => t.title);
}

/**
 * Concurrency-limited map (worker pool).
 * Prevents 1000+ portals from opening 1000 simultaneous sockets.
 * Index increment is safe under the single-threaded event loop.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
