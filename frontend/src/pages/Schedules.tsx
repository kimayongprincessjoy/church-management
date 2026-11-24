import { type FormEvent, useEffect, useState } from "react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import type { ChurchEvent, Schedule, ScheduleOccurrence } from "../types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MANAGE_ROLES = ["super_admin", "pastor", "secretary"];

const emptyForm = {
  name: "", description: "", recurrence: "weekly", day_of_week: "6", day_of_month: "1",
  start_time: "09:00", end_time: "", location: "", is_active: true,
};

export default function Schedules() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? "");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [occurrences, setOccurrences] = useState<ScheduleOccurrence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [s, o] = await Promise.all([
      api.get<Schedule[]>("/schedules"),
      api.get<ScheduleOccurrence[]>("/schedules/occurrences?days=30"),
    ]);
    setSchedules(s.data);
    setOccurrences(o.data);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({
      name: s.name, description: s.description ?? "", recurrence: s.recurrence,
      day_of_week: s.day_of_week != null ? String(s.day_of_week) : "6",
      day_of_month: s.day_of_month != null ? String(s.day_of_month) : "1",
      start_time: s.start_time ? s.start_time.slice(0, 5) : "09:00",
      end_time: s.end_time ? s.end_time.slice(0, 5) : "",
      location: s.location ?? "", is_active: s.is_active,
    });
    setShowForm(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload: any = {
      name: form.name, description: form.description || null,
      recurrence: form.recurrence,
      day_of_week: form.recurrence === "weekly" ? Number(form.day_of_week) : null,
      day_of_month: form.recurrence === "monthly" ? Number(form.day_of_month) : null,
      start_time: form.start_time ? form.start_time + ":00" : null,
      end_time: form.end_time ? form.end_time + ":00" : null,
      location: form.location || null,
      is_active: form.is_active,
    };
    try {
      if (editing) await api.put(`/schedules/${editing.id}`, payload);
      else await api.post("/schedules", payload);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(errMsg(err, "Save failed"));
    }
  };

  const set = (k: string) => (e: { target: any }) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const generate = async () => {
    const res = await api.post<{ created: number; skipped: number }>("/schedules/generate-events?days=30");
    setMessage(`Generated ${res.data.created} events (${res.data.skipped} already existed)`);
    api.get<ChurchEvent[]>("/events").then(() => {});
  };

  const describe = (s: Schedule) =>
    s.recurrence === "weekly"
      ? `Every ${DAY_NAMES[s.day_of_week ?? 0]}`
      : `Monthly on day ${s.day_of_month}`;

  return (
    <div>
      <div className="page-header">
        <h2>Recurring Schedules</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {canManage && <button className="btn btn-gold" onClick={generate}>Generate Events (30 days)</button>}
          {canManage && <button className="btn btn-primary" onClick={openCreate}>+ New Schedule</button>}
        </div>
      </div>
      {message && <div className="success-text" style={{ marginBottom: 12 }}>{message}</div>}

      {showForm && (
        <div className="card">
          <h3>{editing ? "Edit Schedule" : "New Recurring Schedule"}</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label>Name *</label><input value={form.name} onChange={set("name")} required /></div>
              <div className="field">
                <label>Recurrence</label>
                <select value={form.recurrence} onChange={set("recurrence")}>
                  <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </div>
              {form.recurrence === "weekly" ? (
                <div className="field">
                  <label>Day of Week</label>
                  <select value={form.day_of_week} onChange={set("day_of_week")}>
                    {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="field">
                  <label>Day of Month</label>
                  <input type="number" min="1" max="31" value={form.day_of_month} onChange={set("day_of_month")} />
                </div>
              )}
              <div className="field"><label>Start Time</label><input type="time" value={form.start_time} onChange={set("start_time")} /></div>
              <div className="field"><label>End Time</label><input type="time" value={form.end_time} onChange={set("end_time")} /></div>
              <div className="field"><label>Location</label><input value={form.location} onChange={set("location")} /></div>
              <div className="field" style={{ justifyContent: "flex-end" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" checked={form.is_active} onChange={set("is_active")} /> Active
                </label>
              </div>
              <div className="field full"><label>Description</label><textarea rows={2} value={form.description} onChange={set("description")} /></div>
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
          <h3>Schedules</h3>
          <table>
            <thead><tr><th>Name</th><th>When</th><th>Time</th><th>Location</th><th></th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.5 }}>
                  <td><strong>{s.name}</strong></td>
                  <td>{describe(s)}</td>
                  <td>{s.start_time?.slice(0, 5) ?? "—"}</td>
                  <td>{s.location ?? "—"}</td>
                  <td>{canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedules.length === 0 && <div className="empty-state">No recurring schedules</div>}
        </div>
        <div className="card">
          <h3>Next 30 Days Occurrences</h3>
          <table>
            <thead><tr><th>Activity</th><th>Date & Time</th><th>Location</th></tr></thead>
            <tbody>
              {occurrences.map((o, i) => (
                <tr key={i}>
                  <td>{o.name}</td>
                  <td>{new Date(o.occurrence_at).toLocaleString()}</td>
                  <td>{o.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {occurrences.length === 0 && <div className="empty-state">No upcoming occurrences</div>}
        </div>
      </div>
    </div>
  );
}
