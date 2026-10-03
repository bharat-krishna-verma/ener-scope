import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public API surface: login/logout + Vercel cron (secured by CRON_SECRET in the route).
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  const onLogin = pathname.startsWith("/login");
  if (!session && !onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (session && onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/login", "/api/:path*"] };
