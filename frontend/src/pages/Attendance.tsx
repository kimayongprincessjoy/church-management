import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api";
import type { AttendanceRecord, AttendanceSummary, ChurchEvent, MemberListItem } from "../types";

const STATUSES = ["present", "absent", "late", "excused"] as const;

export default function Attendance() {
  const [params] = useSearchParams();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [eventId, setEventId] = useState<number>(Number(params.get("event") ?? 0));
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [search, setSearch] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<ChurchEvent[]>("/events").then((r) => {
      setEvents(r.data);
      if (!eventId && r.data.length) setEventId(r.data[0].id);
    }).catch(() => {});
    api.get<MemberListItem[]>("/members").then((r) => setMembers(r.data)).catch(() => {});
  }, []);

  const refresh = async (id: number) => {
    if (!id) return;
    const [rec, sum] = await Promise.all([
      api.get<AttendanceRecord[]>(`/attendance/events/${id}`),
      api.get<AttendanceSummary>(`/attendance/summary/${id}`),
    ]);
    setRecords(rec.data);
    setSummary(sum.data);
  };

  useEffect(() => { refresh(eventId); }, [eventId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter((m) => m.full_name.toLowerCase().includes(q)).slice(0, 50);
  }, [members, search]);

  const mark = async (member: MemberListItem, status: string) => {
    setError("");
    try {
      await api.post("/attendance/mark", { event_id: eventId, member: String(member.id), status });
      await refresh(eventId);
    } catch (err: any) {
      setError(errMsg(err, "Failed to mark attendance"));
    }
  };

  const addVisitor = async (e: FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) return;
    try {
      await api.post("/attendance/visitor", { event_id: eventId, visitor_name: visitorName });
      setVisitorName("");
      setMessage("Visitor recorded");
      await refresh(eventId);
    } catch (err: any) {
      setError(errMsg(err, "Failed"));
    }
  };

  return (
    <div>
      <div className="page-header"><h2>Attendance Check-in</h2></div>

      <div className="card">
        <div className="toolbar">
          <label style={{ fontWeight: 600 }}>Event:</label>
          <select value={eventId} onChange={(e) => setEventId(Number(e.target.value))} style={{ minWidth: 280 }}>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {new Date(ev.start_at).toLocaleString()} — {ev.title}
              </option>
            ))}
          </select>
        </div>

        {summary && (
          <div className="counter-row">
            <div className="counter"><div className="num" style={{ color: "var(--green)" }}>{summary.present}</div><div className="lbl">Present</div></div>
            <div className="counter"><div className="num" style={{ color: "var(--red)" }}>{summary.absent}</div><div className="lbl">Absent</div></div>
            <div className="counter"><div className="num" style={{ color: "var(--amber)" }}>{summary.late}</div><div className="lbl">Late</div></div>
            <div className="counter"><div className="num">{summary.excused}</div><div className="lbl">Excused</div></div>
            <div className="counter"><div className="num">{summary.visitors}</div><div className="lbl">Visitors</div></div>
          </div>
        )}

        <form onSubmit={addVisitor} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input placeholder="Visitor name (not yet registered)…" value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-gold" type="submit">Add Visitor</button>
        </form>
        {message && <div className="success-text">{message}</div>}
        {error && <div className="error-text">{error}</div>}

        <input placeholder="Search member by name…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 12, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8 }} />

        <table>
          <thead>
            <tr><th>Member</th><th>Category</th><th>Status</th><th>Check-in</th></tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const rec = records.find((r) => r.member_id === m.id);
              return (
                <tr key={m.id}>
                  <td>{m.full_name}</td>
                  <td><span className="badge">{m.category.replace(/_/g, " ")}</span></td>
                  <td>{rec ? <span className={`badge ${rec.status === "present" ? "green" : rec.status === "late" ? "" : "red"}`}>{rec.status}</span> : <span className="badge gray">—</span>}</td>
                  <td>
                    <div className="status-btns">
                      {STATUSES.map((s) => (
                        <button key={s} type="button"
                          className={`status-btn ${s} ${rec?.status === s ? "selected" : ""}`}
                          onClick={() => mark(m, s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Recent Check-ins</h3>
        <table>
          <thead><tr><th>Time</th><th>Name</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>
            {records.slice(-20).reverse().map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.checked_at).toLocaleString()}</td>
                <td>{r.member_name}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{r.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
