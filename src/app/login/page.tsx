"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@enerscope.io");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error || "Login failed.");
    router.replace("/dashboard/overview");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo"><span className="bolt">⚡</span> Ener<span className="scope">Scope</span></div>
        <div className="login-tagline">Power &amp; Energy Opportunity Intelligence</div>
        <h1>Sign in</h1>
        <p className="sub">Tender intelligence console</p>
        <div className="field">
          <label>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {error && <div className="error-text">{error}</div>}
        <p className="hint" style={{ marginTop: 16 }}>
          Dummy login — email <b>admin@enerscope.io</b>, password <b>EnerScope@123</b>
        </p>
      </form>
    </div>
  );
}
