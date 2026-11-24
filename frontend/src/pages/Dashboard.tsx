import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import api from "../api";
import type { DashboardStats } from "../types";

interface TrendPoint { date: string; present?: number; late?: number; [k: string]: any }
interface GrowthPoint { month: string; new_members: number }
interface EventAttendance { event_id: number; title: string; start_at: string; present: number }

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [events, setEvents] = useState<EventAttendance[]>([]);

  useEffect(() => {
    api.get<DashboardStats>("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get<TrendPoint[]>("/dashboard/attendance-trend?days=30").then((r) => setTrend(r.data)).catch(() => {});
    api.get<GrowthPoint[]>("/dashboard/membership-growth").then((r) => setGrowth(r.data)).catch(() => {});
    api.get<EventAttendance[]>("/dashboard/event-attendance").then((r) => setEvents(r.data)).catch(() => {});
  }, []);

  const cards = stats
    ? [
        ["Total Members", stats.total_members],
        ["Active Members", stats.active_members],
        ["Upcoming Events", stats.upcoming_events],
        ["Events This Month", stats.events_this_month],
        ["Attendance Today", stats.attendance_today],
        ["Avg Weekly Attendance", stats.average_weekly_attendance],
        ["New Members This Month", stats.new_members_this_month],
      ]
    : [];

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label as string}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Weekly Attendance Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#1b2a4a" strokeWidth={2} dot={false} name="Present" />
              <Line type="monotone" dataKey="late" stroke="#c9a227" strokeWidth={2} dot={false} name="Late" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Membership Growth</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="new_members" fill="#c9a227" name="New Members" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Attendance per Event</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={events} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="present" fill="#1b2a4a" name="Present" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Upcoming Church Activities</h3>
          {stats?.upcoming_activities?.length ? (
            <table>
              <tbody>
                {stats.upcoming_activities.map((a) => (
                  <tr key={a.schedule_id + a.occurrence_at}>
                    <td>{a.name}</td>
                    <td>{new Date(a.occurrence_at).toLocaleString()}</td>
                    <td>{a.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">No upcoming activities scheduled</div>
          )}
        </div>
      </div>
    </div>
  );
}
