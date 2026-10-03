"use client";
import { useState } from "react";

export default function RunPage() {
  const [running, setRunning] = useState<"real" | "dry" | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function run(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "real"); setError(""); setResult(null);
    try {
      const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Run failed");
      setResult(data.result);
    } catch (e) { setError(String((e as Error).message || e)); }
    setRunning(null);
  }

  return (
    <>
      <div className="topbar"><h1>Run scraper</h1></div>
      <div className="section">
        <div className="toolbar">
          <button className="btn btn-primary" disabled={!!running} onClick={() => run(false)}>
            {running === "real" ? "Running…" : "Run now"}
          </button>
          <button className="btn btn-ghost" disabled={!!running} onClick={() => run(true)}>
            {running === "dry" ? "Scanning…" : "Dry run"}
          </button>
          <span className="hint">
            Dry run = live scrape with <b>nothing saved</b> and <b>no email</b> — a safe preview of what the next real run would find.
            A real run saves new tenders to MongoDB and marks them as seen so they are not reported twice.
          </span>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
      {result && (
        <>
          <div className="cards">
            <div className="card accent"><div className="lbl">New listings scanned</div><div className="num">{result.scrapedCount}</div></div>
            <div className="card"><div className="lbl">Keyword matches</div><div className="num">{result.freshCount}</div></div>
            <div className="card"><div className="lbl">Mode</div><div className="num" style={{ fontSize: 18 }}>{result.dryRun ? "Dry run" : "Real run"}</div></div>
          </div>
          <div className="section">
            <h2>Log</h2>
            <div className="mono">{result.log}</div>
          </div>
          <div className="section">
            <h2>Matched tenders from this run</h2>
            {result.rows.length ? (
              <table className="grid">
                <thead><tr><th>Title</th><th>Organization</th><th>Last date</th><th>Portal</th><th>Link</th></tr></thead>
                <tbody>
                  {result.rows.map((t: any) => (
                    <tr key={t.uid}><td>{t.title}</td><td>{t.org}</td><td>{t.deadline}</td><td>{t.source}</td>
                      <td>{t.link ? <a href={t.link} target="_blank" rel="noreferrer">Open</a> : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="hint">No keyword matches in this run.</p>}
          </div>
        </>
      )}
    </>
  );
}
