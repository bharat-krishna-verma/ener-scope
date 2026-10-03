"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["portals", "Portals"], ["sources", "Sources"], ["keywords", "Keywords"],
  ["email", "Email"], ["excel", "Excel file"], ["users", "Users"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <div className="topbar"><h1>Admin</h1></div>
      <div className="tabs">
        {TABS.map(([slug, label]) => (
          <Link key={slug} href={`/dashboard/admin/${slug}`}
            className={`tab ${pathname.includes(`/admin/${slug}`) ? "active" : ""}`}>{label}</Link>
        ))}
      </div>
      {children}
    </>
  );
}
