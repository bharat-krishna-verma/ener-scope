# EnerScope — QA checklist (tester pass, round 3)

Static review on all sources + live selector validation against the SECI portal.
Runtime items are marked [RUNTIME].

## Round-3 scraper hardening (industry standards)
- [x] Realistic browser headers (Accept-Language, Sec-Fetch-*, modern Chrome UA).
- [x] Retry with exponential backoff on network errors, 429, and 5xx (max 3 attempts).
- [x] Respect Retry-After header when present.
- [x] Small random politeness delay (50–150 ms) before every request.
- [x] Cloudflare / bot-challenge early detection with clear error message.
- [x] CAPTCHA / reCAPTCHA / hCaptcha detection on login pages.
- [x] SSRF guard (badUrl) still applied on every outbound URL.
- [x] Defensive defaults for selectors/access so partial portal docs never crash a run.
- [x] Concurrency pool (mapPool limit 8) remains for 1000+ portals.

## Round-2 fixes (still valid)
- [x] Scheduler wired via instrumentation + idempotent kick in /api/run.
- [x] Middleware Edge-safe (session JWT in jose-only module).
- [x] All /api/* except /api/auth/* require session.
- [x] Test portal falls back to stored credentials when id is provided.
- [x] Excel columns toggleable and used by both download + email attachment.

## Auth
- [x] Wrong password → 401, generic message. scrypt + timing-safe compare.
- [x] Session cookie httpOnly/sameSite=lax/12h.
- [RUNTIME] Login with admin@enerscope.io / EnerScope@123 after `npm run seed`.

## Live scraping validation
- [x] SECI selectors verified against live page structure.
- [RUNTIME] Re-run "Test portal" for SECI/NTPC/IREDA/CEB/NTNSP and confirm row counts > 0.

## Overview / Run / Portals / Email / GeM / Excel / Security
See previous checklist items — all remain [x] or [RUNTIME] as before.
