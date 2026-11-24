export interface Church {
  id: number; name: string; logo_url?: string | null; address?: string | null;
  denomination?: string | null; phone?: string | null; email?: string | null;
  pastor_name?: string | null; description?: string | null; founded_date?: string | null;
}

export interface User {
  id: number; username: string; email: string; full_name: string;
  role: string; is_active: boolean; church_id: number | null;
}

export interface Member {
  id: number; first_name: string; last_name: string; full_name: string;
  category: string; status: string; gender?: string | null;
  birthday?: string | null; phone?: string | null; address?: string | null;
  emergency_contact?: string | null; joined_date?: string | null;
  photo_url?: string | null; qr_token: string; notes?: string | null;
}

export interface MemberListItem {
  id: number; first_name: string; last_name: string; full_name: string;
  category: string; status: string; phone?: string | null;
  joined_date?: string | null; photo_url?: string | null;
}

export interface Ministry {
  id: number; name: string; description?: string | null;
  leader_id?: number | null; schedule_info?: string | null;
  is_active: boolean; member_count: number;
}

export interface ChurchEvent {
  id: number; title: string; description?: string | null; category: string;
  start_at: string; end_at?: string | null; venue?: string | null;
  ministry_id?: number | null; organizer_id?: number | null;
  expected_participants?: number | null; status: string;
  attendance_summary: Record<string, number>;
}

export interface Schedule {
  id: number; name: string; description?: string | null;
  day_of_week?: number | null; day_of_month?: number | null;
  recurrence: string; start_time?: string | null; end_time?: string | null;
  location?: string | null; ministry_id?: number | null;
  responsible_user_id?: number | null; is_active: boolean;
}

export interface ScheduleOccurrence {
  schedule_id: number; name: string; occurrence_at: string; location?: string | null;
}

export interface AttendanceRecord {
  id: number; event_id: number; member_id?: number | null;
  visitor_name?: string | null; status: string; checked_at: string;
  remarks?: string | null; member_name: string;
}

export interface AttendanceSummary {
  present: number; absent: number; late: number; excused: number;
  visitors: number; total: number;
}

export interface DashboardStats {
  total_members: number; active_members: number; upcoming_events: number;
  events_this_month: number; attendance_today: number;
  average_weekly_attendance: number; new_members_this_month: number;
  upcoming_activities: { schedule_id: number; name: string; occurrence_at: string; location?: string | null }[];
}
