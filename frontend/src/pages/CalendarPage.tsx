import { useEffect, useState } from "react";
import api from "../api";
import type { ChurchEvent } from "../types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface CalEvent extends ChurchEvent { _day: Date }

function monthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [view, setView] = useState<"month" | "week">("month");

  useEffect(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0, 23, 59);
    api.get<ChurchEvent[]>("/events", { params: { start: start.toISOString(), end: end.toISOString() } })
      .then((r) => setEvents(r.data.map((e) => ({ ...e, _day: new Date(e.start_at) }))))
      .catch(() => {});
  }, [cursor]);

  const cells = monthMatrix(cursor.getFullYear(), cursor.getMonth());
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const eventsFor = (day: Date) => events.filter((e) => sameDay(e._day, day));

  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));

  return (
    <div>
      <div className="page-header">
        <h2>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date())}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
          </div>
          <select value={view} onChange={(e) => setView(e.target.value as any)}>
            <option value="month">Month</option><option value="week">Week</option>
          </select>
        </div>
      </div>

      {view === "month" ? (
        <div className="card">
          <div className="calendar-grid" style={{ marginBottom: 6 }}>
            {DAY_NAMES.map((d) => <div key={d} style={{ textAlign: "center", fontWeight: 700, color: "var(--muted)", fontSize: ".78rem" }}>{d}</div>)}
          </div>
          <div className="calendar-grid">
            {cells.map((day, i) => (
              <div key={i} className={`cal-day ${!day ? "other" : ""} ${day && sameDay(day, today) ? "today" : ""}`}>
                {day && <div className="day-num">{day.getDate()}</div>}
                {day && eventsFor(day).slice(0, 3).map((e) => (
                  <div key={e.id} className="cal-event" title={e.title}
                    onClick={() => location.href = `/attendance?event=${e.id}`}>
                    {new Date(e.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {e.title}
                  </div>
                ))}
                {day && eventsFor(day).length > 3 && <div className="cal-event">+{eventsFor(day).length - 3} more</div>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          {weekDays.map((d) => {
            const dayEvents = eventsFor(d);
            return (
              <div key={d.toISOString()} style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 6px", color: "var(--navy)" }}>
                  {d.toDateString()} {sameDay(d, today) && <span className="badge green">Today</span>}
                </h4>
                {dayEvents.length === 0 && <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>No events</div>}
                {dayEvents.map((e) => (
                  <div key={e.id} className="cal-event" style={{ display: "inline-block", marginRight: 6 }}
                    onClick={() => location.href = `/attendance?event=${e.id}`}>
                    {new Date(e.start_at).toLocaleTimeString()} — {e.title} ({e.venue ?? "TBD"})
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
