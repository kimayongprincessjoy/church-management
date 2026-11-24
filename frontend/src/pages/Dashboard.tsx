import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import api from "../api";
import { useAuth } from "../auth";
import type { DashboardStats } from "../types";

interface TrendPoint { date: string; present?: number; late?: number; [k: string]: any }
interface GrowthPoint { month: string; new_members: number }
interface EventAttendance { event_id: number; title: string; start_at: string; present: number }

const VERSES = [
  "Where two or three gather in my name, there am I with them. — Matthew 18:20",
  "For where your treasure is, there your heart will be also. — Matthew 6:21",
  "Let us not give up meeting together. — Hebrews 10:25",
  "Be devoted to one another in love. — Romans 12:10",
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const { user, church } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [events, setEvents] = useState<EventAttendance[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<"week" | "month" | "year">("month");
  const [growthFilter, setGrowthFilter] = useState<number>(12);

  useEffect(() => {
    api.get<DashboardStats>("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get<TrendPoint[]>("/dashboard/attendance-trend?days=30").then((r) => setTrend(r.data)).catch(() => {});
    api.get<GrowthPoint[]>("/dashboard/membership-growth").then((r) => setGrowth(r.data)).catch(() => {});
    api.get<EventAttendance[]>("/dashboard/event-attendance").then((r) => setEvents(r.data)).catch(() => {});
  }, []);

  const verse = VERSES[Math.floor(Math.random() * VERSES.length)];
  const greeting = getGreeting();

  const statCards = stats
    ? [
        { label: "Total Members", value: stats.total_members, icon: "👥", color: "green" },
        { label: "Active Members", value: stats.active_members, icon: "✅", color: "blue" },
        { label: "Upcoming Events", value: stats.upcoming_events, icon: "📅", color: "purple" },
        { label: "Events This Month", value: stats.events_this_month, icon: "🗓️", color: "cyan" },
        { label: "Attendance Today", value: stats.attendance_today, icon: "🎯", color: "amber" },
        { label: "Avg Weekly Attendance", value: stats.average_weekly_attendance, icon: "📊", color: "green" },
        { label: "New Members This Month", value: stats.new_members_this_month, icon: "➕", color: "purple" },
      ]
    : [];

  const quickActions = [
    { label: "Add Member", desc: "Register a new church member", icon: "➕", to: "/members" },
    { label: "Create Event", desc: "Schedule a church event", icon: "📅", to: "/events" },
    { label: "Take Attendance", desc: "Mark attendance for an event", icon: "✅", to: "/attendance" },
  ];

  const filteredTrend = trend.slice(attendanceFilter === "week" ? -7 : attendanceFilter === "month" ? -30 : -365);
  const filteredGrowth = growth.slice(-growthFilter);

  const attendanceTotals = filteredTrend.reduce(
    (acc, t) => ({
      present: acc.present + (t.present || 0),
      absent: acc.absent + (t.absent || 0),
      late: acc.late + (t.late || 0),
      excused: acc.excused + (t.excused || 0),
    }),
    { present: 0, absent: 0, late: 0, excused: 0 }
  );
  const totalAttendance = attendanceTotals.present + attendanceTotals.absent + attendanceTotals.late + attendanceTotals.excused;
  const attendancePercent = totalAttendance > 0 ? Math.round((attendanceTotals.present / totalAttendance) * 100) : 0;

  const categoryTotals: Record<string, number> = {};
  events.forEach((e) => {
    const cat = e.title.includes("Worship") ? "worship" : e.title.includes("Study") ? "study" : e.title.includes("Prayer") ? "prayer" : "other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + e.present;
  });
  const maxCategory = Math.max(...Object.values(categoryTotals), 1);

  return (
    <div>
      <div className="welcome-section">
        <h1>{greeting}, {user?.full_name?.split(" ")[0]}!</h1>
        <p>{church?.name} — Here's what's happening today.</p>
        <div className="welcome-verse">{verse}</div>
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-header">
              <div className={`stat-icon ${card.color}`}>{card.icon}</div>
            </div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
            {card.label === "New Members This Month" && card.value > 0 && (
              <div className="stat-change">↑ {card.value} new this month</div>
            )}
          </div>
        ))}
      </div>

      <div className="quick-actions">
        {quickActions.map((action) => (
          <div className="quick-action-card" key={action.label} onClick={() => navigate(action.to)}>
            <div className="quick-action-icon">{action.icon}</div>
            <div className="quick-action-info">
              <div className="quick-action-title">{action.label}</div>
              <div className="quick-action-desc">{action.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="attendance-overview">
          <h3>Attendance Overview</h3>
          <div className="attendance-filters">
            {(["week", "month", "year"] as const).map((f) => (
              <button
                key={f}
                className={`filter-btn ${attendanceFilter === f ? "active" : ""}`}
                onClick={() => setAttendanceFilter(f)}
              >
                {f === "week" ? "This Week" : f === "month" ? "This Month" : "This Year"}
              </button>
            ))}
          </div>
          <div className="attendance-cards">
            <div className="attendance-counter">
              <div className="num">{attendanceTotals.present}</div>
              <div className="label">Present</div>
            </div>
            <div className="attendance-counter">
              <div className="num">{attendanceTotals.absent}</div>
              <div className="label">Absent</div>
            </div>
            <div className="attendance-counter">
              <div className="num">{attendanceTotals.late}</div>
              <div className="label">Late</div>
            </div>
            <div className="attendance-counter">
              <div className="num">{attendanceTotals.excused}</div>
              <div className="label">Excused</div>
            </div>
            <div className="attendance-percentage">
              <div className="num">{attendancePercent}%</div>
              <div className="label">Attendance</div>
            </div>
          </div>
          {filteredTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="present" stroke="#2e7d4f" strokeWidth={2} dot={false} name="Present" />
                <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={false} name="Late" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>No attendance records yet</p>
            </div>
          )}
        </div>

        <div className="upcoming-section">
          <h3>Upcoming Church Activities</h3>
          {stats?.upcoming_activities?.length ? (
            <>
              <ul className="event-list">
                {stats.upcoming_activities.slice(0, 5).map((a) => {
                  const d = new Date(a.occurrence_at);
                  return (
                    <li key={a.schedule_id + a.occurrence_at} className="event-item">
                      <div className="event-date">
                        <div className="day">{d.getDate()}</div>
                        <div className="month">{d.toLocaleString("default", { month: "short" })}</div>
                      </div>
                      <div className="event-info">
                        <div className="event-name">{a.name}</div>
                        <div className="event-meta">
                          <span>{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {a.location && <span>• {a.location}</span>}
                        </div>
                      </div>
                      <span className="event-category-badge">Scheduled</span>
                    </li>
                  );
                })}
              </ul>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/calendar")}>View All</button>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p>No upcoming activities yet.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate("/events")}>
                Create Event
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="growth-section">
          <h3>Membership Growth</h3>
          <div className="growth-filters">
            {[6, 12].map((m) => (
              <button
                key={m}
                className={`filter-btn ${growthFilter === m ? "active" : ""}`}
                onClick={() => setGrowthFilter(m)}
              >
                Last {m} Months
              </button>
            ))}
          </div>
          {filteredGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="new_members" fill="#2e7d4f" name="New Members" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <p>No membership data yet</p>
            </div>
          )}
        </div>

        <div className="category-section">
          <h3>Events by Category</h3>
          <div className="category-list">
            {Object.entries(categoryTotals).length > 0 ? (
              Object.entries(categoryTotals).map(([cat, count]) => (
                <div key={cat} className="category-item">
                  <div
                    className="category-bar"
                    style={{ width: `${(count / maxCategory) * 100}%` }}
                  />
                  <div className="category-info">
                    <div className="category-name">{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
                    <div className="category-count">{count} events</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>No event data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
