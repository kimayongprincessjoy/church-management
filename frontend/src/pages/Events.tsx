import { type FormEvent, useEffect, useState } from "react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import type { ChurchEvent, Ministry } from "../types";

const CATEGORIES = ["worship", "fellowship", "study", "prayer", "outreach", "training", "special", "other"];
const STATUSES = ["scheduled", "cancelled", "completed", "postponed"];
const MANAGE_ROLES = ["super_admin", "pastor", "secretary"];

const emptyForm = {
  title: "", description: "", category: "other", start_at: "", end_at: "",
  venue: "", ministry_id: "", expected_participants: "", status: "scheduled",
};

const toLocalInput = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

export default function Events() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? "");
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChurchEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = () => api.get<ChurchEvent[]>("/events").then((r) => setEvents(r.data)).catch(() => {});

  useEffect(() => {
    load();
    api.get<Ministry[]>("/ministries").then((r) => setMinistries(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, start_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16) });
    setShowForm(true);
    setError("");
  };

  const openEdit = (e: ChurchEvent) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description ?? "", category: e.category,
      start_at: toLocalInput(e.start_at), end_at: toLocalInput(e.end_at),
      venue: e.venue ?? "", ministry_id: e.ministry_id ? String(e.ministry_id) : "",
      expected_participants: e.expected_participants ? String(e.expected_participants) : "",
      status: e.status,
    });
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload: any = {
      title: form.title, description: form.description || null, category: form.category,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      venue: form.venue || null,
      ministry_id: form.ministry_id ? Number(form.ministry_id) : null,
      expected_participants: form.expected_participants ? Number(form.expected_participants) : null,
      status: form.status,
    };
    try {
      if (editing) await api.put(`/events/${editing.id}`, payload);
      else await api.post("/events", payload);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(errMsg(err, "Save failed"));
    }
  };

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const cancel = async (e: ChurchEvent) => {
    if (!confirm(`Cancel "${e.title}"?`)) return;
    await api.put(`/events/${e.id}`, { status: "cancelled" });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Events & Activities</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>}
      </div>

      {showForm && (
        <div className="card">
          <h3>{editing ? "Edit Event" : "New Event"}</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>Title *</label><input value={form.title} onChange={set("title")} required /></div>
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Start *</label><input type="datetime-local" value={form.start_at} onChange={set("start_at")} required /></div>
              <div className="field"><label>End</label><input type="datetime-local" value={form.end_at} onChange={set("end_at")} /></div>
              <div className="field"><label>Venue</label><input value={form.venue} onChange={set("venue")} /></div>
              <div className="field">
                <label>Ministry</label>
                <select value={form.ministry_id} onChange={set("ministry_id")}>
                  <option value="">—</option>
                  {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Expected Participants</label><input type="number" min="0" value={form.expected_participants} onChange={set("expected_participants")} /></div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field full"><label>Description</label><textarea rows={3} value={form.description} onChange={set("description")} /></div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="btn-row">
              <button className="btn btn-primary" type="submit">{editing ? "Save Changes" : "Create Event"}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Event</th><th>When</th><th>Venue</th><th>Category</th><th>Status</th><th>Present</th><th></th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.title}</strong>{e.description && <div style={{ color: "var(--muted)", fontSize: ".78rem" }}>{e.description.slice(0, 60)}</div>}</td>
                <td>{new Date(e.start_at).toLocaleString()}</td>
                <td>{e.venue ?? "—"}</td>
                <td><span className="badge">{e.category}</span></td>
                <td><span className={`badge ${e.status === "scheduled" ? "green" : e.status === "cancelled" ? "red" : "gray"}`}>{e.status}</span></td>
                <td>{e.attendance_summary?.present ?? 0}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a className="btn btn-ghost btn-sm" href={`/attendance?event=${e.id}`}>Attendance</a>
                    {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Edit</button>}
                    {canManage && e.status === "scheduled" && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancel(e)}>Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <div className="empty-state">No events yet</div>}
      </div>
    </div>
  );
}
