"use client";
import { useCallback, useEffect, useState } from "react";

const EMPTY_FORM = {
  name: "", listUrl: "", enabled: true,
  access: { mode: "public", loginUrl: "", user: "", pass: "", cookie: "" },
  selectors: { container: "table tbody tr", title: "", link: "a", org: "", published: "", deadline: "", value: "", summary: "" },
};

export default function PortalsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], total: 0, pages: 1 });
  const [editing, setEditing] = useState<any>(null); // null | "new" | portal id
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/portals?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
    setData(await res.json());
  }, [q, page]);
  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(JSON.parse(JSON.stringify(EMPTY_FORM))); setEditing("new"); setMsg(""); }
  function openEdit(p: any) {
    setForm({ ...p, access: { ...p.access, pass: "", cookie: "" } }); // secrets stay server-side
    setEditing(p._id); setMsg("");
  }
  async function save() {
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/portals" : `/api/portals/${editing}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!d.ok) return setMsg(d.error || "Save failed");
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this portal?")) return;
    await fetch(`/api/portals/${id}`, { method: "DELETE" });
    load();
  }
  async function test(f: any) {
    setMsg("Testing portal…");
    const res = await fetch("/api/portals/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json();
    setMsg(d.ok ? `OK — ${d.found} row(s) found. Sample: ${d.sample.map((s: any) => s.title).join(" | ")}` : `FAILED — ${d.error}`);
  }

  const setA = (k: string, v: string) => setForm((f: any) => ({ ...f, access: { ...f.access, [k]: v } }));
  const setS = (k: string, v: string) => setForm((f: any) => ({ ...f, selectors: { ...f.selectors, [k]: v } }));

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search portals… (1000+ supported)" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <div className="grow" />
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Add portal</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      <table className="grid">
        <thead><tr><th>Portal</th><th>Listing URL</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {data.items.map((p: any) => (
            <tr key={p._id}>
              <td><b>{p.name}</b></td>
              <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.listUrl}</td>
              <td><span className={`badge ${p.access.mode === "public" ? "green" : "grey"}`}>{p.access.mode}</span></td>
              <td>{p.lastStatus || "—"}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>{" "}
                <button className="btn btn-danger btn-sm" onClick={() => remove(p._id)}>Remove</button>
              </td>
            </tr>
          ))}
          {!data.items.length && <tr><td colSpan={5} className="hint">No portals found.</td></tr>}
        </tbody>
      </table>
      <div className="pager">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span className="hint">{page} / {data.pages} — {data.total} portal(s)</span>
        <button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === "new" ? "Add portal" : "Edit portal"}</h3>
            <div className="grid2">
              <div className="field"><label>Portal name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Tender listing page URL *</label>
                <input className="input" value={form.listUrl} onChange={(e) => setForm({ ...form, listUrl: e.target.value })} /></div>
              <div className="field"><label>Access</label>
                <select className="input" value={form.access.mode} onChange={(e) => setA("mode", e.target.value)}>
                  <option value="public">Public page (no login)</option>
                  <option value="login">Form login (username + password)</option>
                  <option value="cookie">Saved browser session (cookie)</option>
                </select>
                <p className="hint">
                  {form.access.mode === "public" && "Best when the tender list is openly visible."}
                  {form.access.mode === "login" && "We auto-submit the portal's login form. Fails if the portal shows a CAPTCHA — use Saved session then."}
                  {form.access.mode === "cookie" && "Most reliable for guarded portals: log in manually in your browser, then paste your session cookies here."}
                </p></div>
              <div className="field"><label>Enabled</label>
                <select className="input" value={String(form.enabled)} onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}>
                  <option value="true">Enabled</option><option value="false">Disabled</option>
                </select></div>
              {form.access.mode !== "public" && (
                <>
                  {form.access.mode === "login" && (
                    <>
                      <div className="field"><label>Login page URL</label>
                        <input className="input" value={form.access.loginUrl} onChange={(e) => setA("loginUrl", e.target.value)} /></div>
                      <div className="field"><label>Username</label>
                        <input className="input" value={form.access.user} onChange={(e) => setA("user", e.target.value)} /></div>
                      <div className="field"><label>Password</label>
                        <input className="input" type="password" placeholder="leave blank to keep saved" value={form.access.pass} onChange={(e) => setA("pass", e.target.value)} /></div>
                    </>
                  )}
                  {form.access.mode === "cookie" && (
                    <div className="field" style={{ gridColumn: "1 / -1" }}><label>Session cookie</label>
                      <textarea className="input" rows={3} placeholder="name=value; name2=value2 — leave blank to keep saved"
                        value={form.access.cookie} onChange={(e) => setA("cookie", e.target.value)} /></div>
                  )}
                </>
              )}
            </div>
            <h3 style={{ fontSize: 14 }}>Row selectors (advanced — the scraper reads these on every run)</h3>
            <div className="grid2">
              {(["container", "title", "link", "org", "published", "deadline", "value", "summary"] as const).map((k) => (
                <div className="field" key={k}><label style={{ textTransform: "none" }}>{k}</label>
                  <input className="input" value={form.selectors[k]} onChange={(e) => setS(k, e.target.value)} /></div>
              ))}
            </div>
            <div className="toolbar" style={{ marginTop: 18 }}>
              <button className="btn btn-dark" onClick={() => test(form)}>Test portal</button>
              <div className="grow" />
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
