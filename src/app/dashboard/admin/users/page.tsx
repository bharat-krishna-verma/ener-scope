"use client";
import { useCallback, useEffect, useState } from "react";
export default function UsersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState({ email: "", name: "", password: "", role: "user" });
  const load = useCallback(() => { fetch("/api/users").then((r) => r.json()).then((d) => setItems(d.items)); }, []);
  useEffect(load, [load]);
  async function add() {
    await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setF({ email: "", name: "", password: "", role: "user" }); load();
  }
  async function resetPw(u: any) {
    const password = prompt(`New password for ${u.email}:`); if (!password) return;
    await fetch(`/api/users/${u._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  }
  async function remove(u: any) { if (confirm(`Delete ${u.email}?`)) { await fetch(`/api/users/${u._id}`, { method: "DELETE" }); load(); } }
  return (
    <>
      <div className="section">
        <h2>Add user</h2>
        <div className="grid2">
          <div className="field"><label>Email</label><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label>Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>Password</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="field"><label>Role</label><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></select></div>
        </div>
        <button className="btn btn-primary" onClick={add} disabled={!f.email || !f.password}>Add user</button>
      </div>
      <div className="section">
        <h2>Users</h2>
        <table className="grid">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{items.map((u) => (
            <tr key={u._id}><td>{u.email}</td><td>{u.name}</td><td><span className="badge grey">{u.role}</span></td>
              <td>{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => resetPw(u)}>Reset password</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>Delete</button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
