"use client";
import { useEffect, useState } from "react";
export default function KeywordsPage() {
  const [kw, setKw] = useState(""); const [ex, setEx] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/keywords").then((r) => r.json()).then((d) => { setKw(d.keywords.join("\n")); setEx(d.excludeKeywords.join("\n")); }); }, []);
  async function save() {
    const split = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    await fetch("/api/keywords", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: split(kw), excludeKeywords: split(ex) }) });
    setMsg("Saved. Applies from the very next run — every portal and source is filtered by these.");
  }
  return (
    <div className="section">
      <h2>Keywords</h2>
      <div className="grid2">
        <div className="field"><label>Include keywords (one per line)</label>
          <textarea className="input" rows={8} value={kw} onChange={(e) => setKw(e.target.value)} /></div>
        <div className="field"><label>Exclude keywords (one per line)</label>
          <textarea className="input" rows={8} value={ex} onChange={(e) => setEx(e.target.value)} /></div>
      </div>
      {msg && <p className="hint ok">{msg}</p>}
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={save}>Save keywords</button>
    </div>
  );
}
