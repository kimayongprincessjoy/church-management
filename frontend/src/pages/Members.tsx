import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import type { Member, MemberListItem } from "../types";

const CATEGORIES = ["regular", "youth", "children", "church_worker", "ministry_leader", "visitor", "new_convert"];
const STATUSES = ["active", "inactive", "deceased", "transferred"];
const MANAGE_ROLES = ["super_admin", "pastor", "secretary"];

const emptyForm = {
  first_name: "", last_name: "", category: "regular", status: "active",
  gender: "", birthday: "", phone: "", address: "", emergency_contact: "",
  joined_date: "", photo_url: "", notes: "",
};

export default function Members() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? "");
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    const res = await api.get<MemberListItem[]>(`/members?${params}`);
    setMembers(res.data);
  };

  useEffect(() => { load().catch(() => {}); }, [category]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, joined_date: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
    setError("");
  };

  const openEdit = async (m: MemberListItem) => {
    const res = await api.get<Member>(`/members/${m.id}`);
    setEditing(res.data);
    const f: any = { ...emptyForm };
    for (const k of Object.keys(emptyForm)) {
      const v = (res.data as any)[k];
      f[k] = v ?? (k.endsWith("_date") || k === "birthday" ? "" : "");
    }
    setForm(f);
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload: any = { ...form };
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
    try {
      if (editing) {
        await api.put(`/members/${editing.id}`, payload);
      } else {
        await api.post("/members", payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(errMsg(err, "Save failed"));
    }
  };

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <h2>Members</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ Add Member</button>}
      </div>

      {showForm && (
        <div className="card">
          <h3>{editing ? "Edit Member" : "New Member"}</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>First Name *</label><input value={form.first_name} onChange={set("first_name")} required /></div>
              <div className="field"><label>Last Name</label><input value={form.last_name} onChange={set("last_name")} /></div>
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Gender</label>
                <select value={form.gender} onChange={set("gender")}>
                  <option value="">—</option><option value="male">Male</option>
                  <option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
              <div className="field"><label>Birthday</label><input type="date" value={form.birthday} onChange={set("birthday")} /></div>
              <div className="field"><label>Phone</label><input value={form.phone} onChange={set("phone")} /></div>
              <div className="field"><label>Date Joined</label><input type="date" value={form.joined_date} onChange={set("joined_date")} /></div>
              <div className="field full"><label>Address</label><input value={form.address} onChange={set("address")} /></div>
              <div className="field"><label>Emergency Contact</label><input value={form.emergency_contact} onChange={set("emergency_contact")} /></div>
              <div className="field"><label>Photo URL</label><input value={form.photo_url} onChange={set("photo_url")} /></div>
              <div className="field full"><label>Notes</label><textarea rows={2} value={form.notes} onChange={set("notes")} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="btn-row">
              <button className="btn btn-primary" type="submit">{editing ? "Save Changes" : "Add Member"}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <input placeholder="Search by name or phone…" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load}>Search</button>
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Category</th><th>Status</th><th>Phone</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.full_name}</td>
                <td><span className="badge">{m.category.replace(/_/g, " ")}</span></td>
                <td><span className={`badge ${m.status === "active" ? "green" : "gray"}`}>{m.status}</span></td>
                <td>{m.phone ?? "—"}</td>
                <td>{m.joined_date ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link className="btn btn-ghost btn-sm" to={`/members/${m.id}`}>View</Link>
                    {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <div className="empty-state">No members found</div>}
      </div>
    </div>
  );
}
