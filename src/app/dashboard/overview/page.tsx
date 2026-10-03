"use client";
import { useEffect, useState } from "react";

type Row = { uid: string; title: string; org: string; published: string; deadline: string; value: string; summary: string; source: string; link: string; days: number | ""; foundAt: string };

function TenderTable({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="hint">{empty}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="grid">
        <thead>
          <tr><th>Tender title</th><th>Organization</th><th>Reference</th><th>Published</th><th>Last date</th><th>Days left</th><th>Portal</th><th>Link</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.uid}>
              <td>{t.title}</td><td>{t.org}</td><td>{t.summary}</td><td>{t.published}</td><td>{t.deadline}</td>
              <td>{t.days === "" ? "—" : t.days < 0 ? <span className="badge grey">closed</span> : t.days <= 7 ? <span className="badge hot">{t.days} d</span> : `${t.days} d`}</td>
              <td><span className="badge green">{t.source}</span></td>
              <td>{t.link ? <a href={t.link} target="_blank" rel="noreferrer">Open</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch("/api/analytics").then((r) => r.json()).then(setData); }, []);
  if (!data) return <p>Loading…</p>;
  const a = data.analytics;
  const cards = [
    { lbl: "Today's tenders", num: a.todayTotal, accent: true },
    { lbl: "Overall tenders", num: a.overall },
    { lbl: "Portals configured", num: a.portals },
    { lbl: "External sources", num: a.sources },
    { lbl: "Last run", num: a.lastRunAt ? new Date(a.lastRunAt).toLocaleString("en-IN") : "Never" },
  ];
  return (
    <>
      <div className="topbar"><h1>Overview</h1></div>
      <div className="cards">
        {cards.map((c) => (
          <div key={c.lbl} className={`card ${c.accent ? "accent" : ""}`}>
            <div className="lbl">{c.lbl}</div>
            <div className="num">{c.num}</div>
          </div>
        ))}
      </div>
      <div className="section">
        <h2>Today's tenders</h2>
        <TenderTable rows={data.today} empty="No tenders found today yet. The scheduler will populate this after the next run." />
      </div>
      <div className="section">
        <h2>Earlier tenders</h2>
        <TenderTable rows={data.earlier} empty="No earlier tenders on record." />
      </div>
    </>
  );
}
