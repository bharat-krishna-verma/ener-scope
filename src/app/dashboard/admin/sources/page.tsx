"use client";
import { useEffect, useState } from "react";

export default function SourcesPage() {
  const [f, setF] = useState({ enabled: true, gemUser: "", gemPass: "", gemSessionCookie: "", gemListUrl: "https://bidplus.gem.gov.in/all-bids" });
  const [status, setStatus] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/sources/gem").then((r) => r.json()).then((d) => {
    if (d.item) setF((prev) => ({ ...prev, ...d.item, gemPass: "" }));
    setStatus(d.item ? { lastStatus: d.item.lastStatus, lastCheckedAt: d.item.lastCheckedAt } : null);
  }); }, []);

  async function save() {
    const res = await fetch("/api/sources/gem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setMsg((await res.json()).ok ? "Saved. GeM will be included in the next run." : "Save failed.");
  }
  async function test() {
    setMsg("Testing GeM session…");
    const d = await (await fetch("/api/sources/gem", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true, gemSessionCookie: f.gemSessionCookie, gemListUrl: f.gemListUrl }) })).json();
    setMsg(d.ok ? `OK — ${d.message}` : `FAILED — ${d.message}`);
  }

  return (
    <>
      <div className="section">
        <h2>GeM — Government e-Marketplace (India)</h2>
        <p className="hint">
          GeM has no public bid-listing API and its login is CAPTCHA-protected, so plain scraping cannot log in for you.
          The reliable pattern is: <b>you log in once in your browser → export your session cookies → paste them here.</b>{" "}
          We validate the session with a &quot;Test&quot; call and reuse it during runs. Your username/password are stored
          AES-256 encrypted and are only used to re-establish a session (e.g. via the optional Playwright connector in the README).
        </p>
        <ol className="hint">
          <li>Sign in at <a href="https://gem.gov.in" target="_blank" rel="noreferrer">gem.gov.in</a> (solve CAPTCHA yourself, one time).</li>
          <li>Open <a href="https://bidplus.gem.gov.in/all-bids" target="_blank" rel="noreferrer">bidplus.gem.gov.in/all-bids</a>.</li>
          <li>DevTools → Application → Cookies → copy the cookie string (or use a cookie-export browser extension).</li>
          <li>Paste below, press &quot;Test session&quot;, then Save.</li>
        </ol>
      </div>
      <div className="section">
        <div className="grid2">
          <div className="field"><label>GeM username / registered email</label>
            <input className="input" value={f.gemUser} onChange={(e) => setF({ ...f, gemUser: e.target.value })} /></div>
          <div className="field"><label>GeM password (stored encrypted)</label>
            <input className="input" type="password" value={f.gemPass} onChange={(e) => setF({ ...f, gemPass: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Session cookie</label>
            <textarea className="input" rows={3} value={f.gemSessionCookie} onChange={(e) => setF({ ...f, gemSessionCookie: e.target.value })} /></div>
          <div className="field"><label>Bid listing URL</label>
            <input className="input" value={f.gemListUrl} onChange={(e) => setF({ ...f, gemListUrl: e.target.value })} /></div>
          <div className="field"><label>Enabled</label>
            <select className="input" value={String(f.enabled)} onChange={(e) => setF({ ...f, enabled: e.target.value === "true" })}>
              <option value="true">Enabled</option><option value="false">Disabled</option>
            </select></div>
        </div>
        {status?.lastStatus && <p className="hint">Last run: {status.lastStatus} at {status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString("en-IN") : "—"}</p>}
        {msg && <p className="hint">{msg}</p>}
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn btn-dark" onClick={test}>Test session</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}
