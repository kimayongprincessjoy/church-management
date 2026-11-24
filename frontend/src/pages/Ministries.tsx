import { type FormEvent, useEffect, useState } from "react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import type { MemberListItem, Ministry, User } from "../types";

const MANAGE_ROLES = ["super_admin", "pastor", "secretary", "ministry_leader"];

interface MinistryMember { id: number; member_id: number; member_name: string; role_in_ministry?: string | null }

export default function Ministries() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? "");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [detail, setDetail] = useState<Ministry | null>(null);
  const [members, setMembers] = useState<MinistryMember[]>([]);
  const [allMembers, setAllMembers] = useState<MemberListItem[]>([]);
  const [addMemberId, setAddMemberId] = useState("");
  const [form, setForm] = useState({ name: "", description: "", leader_id: "", schedule_info: "" });
  const [error, setError] = useState("");

  const load = () => api.get<Ministry[]>("/ministries").then((r) => setMinistries(r.data)).catch(() => {});

  useEffect(() => {
    load();
    api.get<MemberListItem[]>("/members").then((r) => setAllMembers(r.data)).catch(() => {});
    api.get<User[]>("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", leader_id: "", schedule_info: "" });
    setShowForm(true);
    setError("");
  };

  const openEdit = (m: Ministry) => {
    setEditing(m);
    setForm({
      name: m.name, description: m.description ?? "",
      leader_id: m.leader_id ? String(m.leader_id) : "",
      schedule_info: m.schedule_info ?? "",
    });
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name, description: form.description || null,
      leader_id: form.leader_id ? Number(form.leader_id) : null,
      schedule_info: form.schedule_info || null,
    };
    try {
      if (editing) await api.put(`/ministries/${editing.id}`, payload);
      else await api.post("/ministries", payload);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(errMsg(err, "Save failed"));
    }
  };

  const openDetail = async (m: Ministry) => {
    setDetail(m);
    const res = await api.get<MinistryMember[]>(`/ministries/${m.id}/members`);
    setMembers(res.data);
  };

  const addMember = async () => {
    if (!detail || !addMemberId) return;
    try {
      await api.post(`/ministries/${detail.id}/members`, { member_id: Number(addMemberId) });
      setAddMemberId("");
      openDetail(detail);
      load();
    } catch (err: any) {
      alert(errMsg(err, "Failed to add member"));
    }
  };

  const removeMember = async (memberId: number) => {
    if (!detail) return;
    await api.delete(`/ministries/${detail.id}/members/${memberId}`);
    openDetail(detail);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Ministries & Departments</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New Ministry</button>}
      </div>

      {showForm && (
        <div className="card">
          <h3>{editing ? "Edit Ministry" : "New Ministry"}</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="field">
                <label>Leader</label>
                <select value={form.leader_id} onChange={(e) => setForm({ ...form, leader_id: e.target.value })}>
                  <option value="">—</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="field"><label>Regular Schedule</label><input value={form.schedule_info} onChange={(e) => setForm({ ...form, schedule_info: e.target.value })} placeholder="e.g. Every Sunday 9am" /></div>
              <div className="field full"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="btn-row">
              <button className="btn btn-primary" type="submit">{editing ? "Save" : "Create"}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>All Ministries</h3>
          <table>
            <thead><tr><th>Name</th><th>Members</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {ministries.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong>{m.description && <div style={{ color: "var(--muted)", fontSize: ".78rem" }}>{m.description.slice(0, 50)}</div>}</td>
                  <td>{m.member_count}</td>
                  <td><span className={`badge ${m.is_active ? "green" : "gray"}`}>{m.is_active ? "active" : "inactive"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openDetail(m)}>Members</button>
                      {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ministries.length === 0 && <div className="empty-state">No ministries yet</div>}
        </div>

        <div className="card">
          <h3>{detail ? `${detail.name} — Members` : "Select a ministry"}</h3>
          {detail ? (
            <>
              {canManage && (
                <div className="toolbar">
                  <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)}>
                    <option value="">Add member…</option>
                    {allMembers.filter((m) => !members.some((mm) => mm.member_id === m.id)).map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={addMember} disabled={!addMemberId}>Add</button>
                </div>
              )}
              <table>
                <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
                <tbody>
                  {members.map((mm) => (
                    <tr key={mm.id}>
                      <td>{mm.member_name}</td>
                      <td>{mm.role_in_ministry ?? "—"}</td>
                      <td>{canManage && <button className="btn btn-danger btn-sm" onClick={() => removeMember(mm.member_id)}>Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {members.length === 0 && <div className="empty-state">No members in this ministry</div>}
            </>
          ) : (
            <div className="empty-state">Click "Members" on a ministry to manage its roster</div>
          )}
        </div>
      </div>
    </div>
  );
}
