"use client";
import { useEffect, useState } from "react";

export default function ExcelPage() {
  const [f, setF] = useState({ prefix: "EnerScope_Digest", sort: "deadline", highlightDays: 14, splitByPortal: false });
  const [cols, setCols] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings?key=excel").then((r) => r.json()).then((d) => {
      const v = d.value;
      setF({ prefix: v.prefix, sort: v.sort, highlightDays: v.highlightDays, splitByPortal: v.splitByPortal });
      setCols(v.columns && v.columns.length ? v.columns : [
        { label: "Tender title", on: true, field: "title" }, { label: "Organization", on: true, field: "org" },
        { label: "Reference", on: true, field: "summary" }, { label: "Published", on: true, field: "published" },
        { label: "Last date", on: true, field: "deadline" }, { label: "Days left", on: true, field: "days" },
        { label: "Portal", on: true, field: "source" }, { label: "Link", on: true, field: "link" },
      ]);
    });
  }, []);

  async function save() {
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "excel", value: { ...f, columns: cols } }) });
    setMsg((await res.json()).ok ? "Saved. Emails and downloads will use these columns." : "Save failed.");
  }

  return (
    <div className="section">
      <h2>Excel file</h2>
      <p className="hint">The workbook always contains two sheets with the same columns: <b>Todays Tenders</b> and <b>Earlier Tenders</b> (optionally split by portal). Rows closing within the highlight window are shaded.</p>
      <h3 style={{ fontSize: 14 }}>Columns</h3>
      <table className="grid" style={{ marginBottom: 16 }}>
        <thead><tr><th>Include</th><th>Column</th></tr></thead>
        <tbody>{cols.map((c, i) => (
          <tr key={c.field}>
            <td><input type="checkbox" checked={c.on} onChange={(e) =>
              setCols(cols.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /></td>
            <td>{c.label}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="grid2">
        <div className="field"><label>File name prefix</label><input className="input" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} /></div>
        <div className="field"><label>Sort by</label>
          <select className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
            <option value="deadline">Deadline</option><option value="published">Published date</option>
            <option value="portal">Portal</option><option value="found">Date found</option></select></div>
        <div className="field"><label>Highlight rows closing within (days)</label>
          <input className="input" type="number" value={f.highlightDays} onChange={(e) => setF({ ...f, highlightDays: Number(e.target.value) })} /></div>
        <div className="field"><label>Split earlier tenders by portal into separate sheets</label>
          <select className="input" value={String(f.splitByPortal)} onChange={(e) => setF({ ...f, splitByPortal: e.target.value === "true" })}>
            <option value="false">No — one "Earlier Tenders" sheet</option><option value="true">Yes</option></select></div>
      </div>
      {msg && <p className="hint ok">{msg}</p>}
      <div className="toolbar" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <a className="btn btn-dark" href="/api/excel/download">Download current Excel</a>
      </div>
    </div>
  );
}
