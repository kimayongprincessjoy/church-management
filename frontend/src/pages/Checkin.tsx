import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api";
import { useAuth } from "../auth";
import type { ChurchEvent } from "../types";

/** Public-ish check-in page reached by scanning a member's QR code. */
export default function Checkin() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string }>({ ok: false, text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<ChurchEvent[]>("/events?upcoming=true").then((r) => {
      setEvents(r.data);
      if (r.data.length) setEventId(String(r.data[0].id));
    }).catch(() => {});
  }, [user]);

  const scan = async () => {
    if (!eventId || !token) return;
    setBusy(true);
    setResult({ ok: false, text: "" });
    try {
      const res = await api.post("/attendance/qr-scan", { event_id: Number(eventId), member: token, status: "present" });
      setResult({ ok: true, text: `Welcome, ${res.data.member_name}! Attendance recorded.` });
    } catch (err: any) {
      setResult({ ok: false, text: errMsg(err, "Check-in failed") });
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h1>Check-in</h1>
          <p className="sub">Please sign in with an attendance checker or staff account first.</p>
          <a className="btn btn-primary" href="/login">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Member Check-in</h1>
        <p className="sub">QR token: <code>{token.slice(0, 12)}…</code></p>
        <div className="field">
          <label>Select Event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title} — {new Date(e.start_at).toLocaleString()}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={scan} disabled={busy || !eventId} style={{ marginTop: 16, width: "100%" }}>
          {busy ? "Recording…" : "Record Attendance"}
        </button>
        {result.text && <div className={result.ok ? "success-text" : "error-text"} style={{ marginTop: 14 }}>{result.text}</div>}
      </div>
    </div>
  );
}
