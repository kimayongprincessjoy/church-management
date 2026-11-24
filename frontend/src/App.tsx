import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout, { Protected } from "./components/Layout";
import Login from "./pages/Login";
import ChurchSetup from "./pages/ChurchSetup";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import Events from "./pages/Events";
import CalendarPage from "./pages/CalendarPage";
import Attendance from "./pages/Attendance";
import Schedules from "./pages/Schedules";
import Ministries from "./pages/Ministries";
import Reports from "./pages/Reports";
import Checkin from "./pages/Checkin";
import { Users, ChurchSettings } from "./pages/Admin";

function HomeRedirect() {
  const { church, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!church) return <Navigate to="/setup" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<ChurchSetup />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:id" element={<MemberDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/ministries" element={<Ministries />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/church" element={<ChurchSettings />} />
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
