import { useEffect, useState } from "react";
import api from "../api";
import type { AttendanceRecord } from "../types";

export default function Reports() {
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<AttendanceRecord[]>("/attendance/report", {
        params: { start: new Date(start).toISOString(), end: new Date(end + "T23:59:59").toISOString() },
      });
      setRecords(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const url = `/api/attendance/report?format=csv&start=${encodeURIComponent(new Date(start).toISOString())}&end=${encodeURIComponent(new Date(end + "T23:59:59").toISOString())}`;
    // fetch with auth header then download
    const token = localStorage.getItem("token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "attendance_report.csv";
        a.click();
      });
  };

  const byStatus: Record<string, number> = {};
  records.forEach((r) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; });

  return (
    <div>
      <div className="page-header"><h2>Reports & Analytics</h2></div>

      <div className="card">
        <div className="toolbar">
          <label>From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={load} disabled={loading}>Generate</button>
          <button className="btn btn-gold" onClick={exportCsv}>Export CSV</button>
        </div>

        <div className="counter-row">
          <div className="counter"><div className="num">{records.length}</div><div className="lbl">Total Records</div></div>
          {Object.entries(byStatus).map(([s, n]) => (
            <div className="counter" key={s}><div className="num">{n}</div><div className="lbl">{s}</div></div>
          ))}
        </div>

        <table>
          <thead><tr><th>Date</th><th>Event</th><th>Name</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.checked_at).toLocaleDateString()}</td>
                <td>#{r.event_id}</td>
                <td>{r.member_name}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{r.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div className="empty-state">No attendance records in this period</div>}
      </div>
    </div>
  );
}
