import { type FormEvent, useEffect, useState } from "react";
import api, { errMsg } from "../api";
import type { Church, User } from "../types";
import { useAuth } from "../auth";

const ROLES = ["super_admin", "pastor", "secretary", "attendance_checker", "ministry_leader"];

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ username: "", email: "", full_name: "", password: "", role: "attendance_checker" });
  const [error, setError] = useState("");

  const load = () => api.get<User[]>("/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/users", form);
      setForm({ username: "", email: "", full_name: "", password: "", role: "attendance_checker" });
      load();
    } catch (err: any) {
      setError(errMsg(err, "Failed to create user"));
    }
  };

  return (
    <div>
      <div className="page-header"><h2>User Accounts</h2></div>
      <div className="grid-2">
        <div className="card">
          <h3>Users</h3>
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td><td>{u.username}</td>
                  <td><span className="badge">{u.role.replace(/_/g, " ")}</span></td>
                  <td><span className={`badge ${u.is_active ? "green" : "red"}`}>{u.is_active ? "active" : "disabled"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Add User</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>Full Name *</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div className="field"><label>Username *</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
              <div className="field"><label>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="field"><label>Password * (min 8)</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Create User</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ChurchSettings() {
  const { church, refreshChurch } = useAuth();
  const [form, setForm] = useState<Partial<Church>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (church) setForm(church); }, [church]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setSaved(false);
    try {
      await api.put("/church", { ...form, id: church?.id });
      await refreshChurch();
      setSaved(true);
    } catch (err: any) {
      setError(errMsg(err, "Save failed"));
    }
  };

  const set = (k: keyof Church) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value || null }));

  return (
    <div>
      <div className="page-header"><h2>Church Settings</h2></div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label>Church Name *</label><input value={form.name ?? ""} onChange={set("name")} required /></div>
            <div className="field"><label>Logo URL</label><input value={form.logo_url ?? ""} onChange={set("logo_url")} placeholder="https://…" /></div>
            <div className="field"><label>Denomination</label><input value={form.denomination ?? ""} onChange={set("denomination")} /></div>
            <div className="field"><label>Phone</label><input value={form.phone ?? ""} onChange={set("phone")} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email ?? ""} onChange={set("email")} /></div>
            <div className="field"><label>Pastor's Name</label><input value={form.pastor_name ?? ""} onChange={set("pastor_name")} /></div>
            <div className="field"><label>Founded Date</label><input type="date" value={form.founded_date ?? ""} onChange={set("founded_date")} /></div>
            <div className="field full"><label>Address</label><input value={form.address ?? ""} onChange={set("address")} /></div>
            <div className="field full"><label>Description</label><textarea rows={3} value={form.description ?? ""} onChange={set("description")} /></div>
          </div>
          {error && <div className="error-text">{error}</div>}
          {saved && <div className="success-text">Church settings saved</div>}
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Save Settings</button>
        </form>
      </div>
    </div>
  );
}
