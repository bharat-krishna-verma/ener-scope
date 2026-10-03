# ⚡ EnerScope — Power & Energy Opportunity Intelligence

Tender discovery & digest platform. Stack: **Node.js · TypeScript · Next.js (App Router) · MongoDB (Mongoose)**.

## Run
1. `cp .env.example .env` — set `MONGODB_URI` (local MongoDB or Atlas) and a long random `AUTH_SECRET`.
2. `npm install`
3. `npm run seed` — creates the dummy login **admin@enerscope.io / EnerScope@123**, default portals, keywords, email/excel/schedule defaults.
4. `npm run dev` → http://localhost:3000 → sign in.
5. The scheduler starts at server boot via `src/instrumentation.ts` (also kicked idempotently on the first /api/run call): it scrapes every `runIntervalMinutes` and sends the digest **once daily at `emailTime`** with the Excel attached (Today's + Earlier sheets). For hardened deployments run the scheduler in a separate worker process instead.

## Tabs
- **Overview** — analytics (today's tenders, overall tenders, portal count, sources, last run) + Today's tenders table + Earlier tenders table (same columns). No run buttons.
- **Run** — Run now / Dry run (dry run previews without saving or emailing; explained on the page).
- **Admin → Portals** — searchable, paginated list (1000+ portals), add/edit/remove, three access modes (Public / Form login / Saved session cookie), per-portal selectors, **Test portal** (uses stored credentials for existing portals).
- **Admin → Sources** — GeM connector (see below).
- **Admin → Keywords** — include/exclude keyword lists, applied to every source on every run.
- **Admin → Email** — SMTP login + app password, receivers, **send time (once daily)**, scrape interval, test email.
- **Admin → Excel file** — toggleable columns, filename prefix, sort order, highlight window, portal-split sheets, live download.
- **Admin → Users** — add users, reset passwords, roles.

## GeM (Sources tab)
GeM has no public bid-listing API and CAPTCHA-protected login, so the supported flow is:
1. Sign in at gem.gov.in manually (solve CAPTCHA once).
2. Open bidplus.gem.gov.in/all-bids, copy your session cookies (DevTools → Application → Cookies, or a cookie-export extension).
3. Paste in EnerScope → **Test session** → Save. Cookies are AES-256 encrypted at rest.
When cookies expire, re-import. Your GeM username/password are stored encrypted and can re-establish a session via the optional Playwright helper below.

### Optional: Playwright re-login helper
- `npm i playwright` and `npx playwright install chromium`
- Flow: open https://gem.gov.in → fill username/password → **pause for manual CAPTCHA/OTP** → POST the resulting cookies back to `/api/sources/gem`.
- Helper only; cookie import from your browser remains the primary flow.

## Email
Gmail requires a 16-char **App password** (2-Step Verification must be on). Outlook/other providers: their SMTP host + app password. The digest email lists today's tenders in the body and attaches an `.xls` with **Todays Tenders** + **Earlier Tenders** sheets. It sends once per day at the configured time even if the scraper ran many times.

## Notes
- Every scrape run re-reads portal/source/settings documents **fresh from MongoDB** — newly added/edited portals, selectors, columns and keywords are picked up immediately.
- Dry run never writes to MongoDB and never sends email.
- Portal passwords/cookies, GeM credentials, SMTP app password: AES-256-GCM encrypted at rest; never returned by the API.
- `badUrl()` blocks private/local addresses on every fetch (SSRF guard).
- Scraper (round-3): realistic browser headers, retry + exponential backoff (429/5xx/network), Retry-After support, politeness delay, Cloudflare/CAPTCHA detection, concurrency pool of 8.
- QA test plan: see `tests/qa-checklist.md`.
