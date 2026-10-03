import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import LogoutButton from "./logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="bolt">⚡</span> Ener<span className="scope">Scope</span></div>
        <div className="tagline">Power &amp; Energy Opportunity Intelligence</div>
        <Link className="navlink" href="/dashboard/overview">Overview</Link>
        <Link className="navlink" href="/dashboard/run">Run</Link>
        <Link className="navlink" href="/dashboard/admin/portals">Admin</Link>
        <div className="spacer" />
        <div style={{ padding: "0 10px", fontSize: 12, color: "#9a9a9a" }}>{session.email}</div>
        <LogoutButton />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
