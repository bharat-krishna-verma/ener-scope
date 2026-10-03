"use client";
import { useRouter } from "next/navigation";
export default function LogoutButton() {
  const router = useRouter();
  return (
    <button className="navlink" style={{ background: "none", border: "none", textAlign: "left", width: "100%" }}
      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }}>
      Sign out
    </button>
  );
}
