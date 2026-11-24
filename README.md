# Church Management System

A full-stack church management system: **React** frontend, **FastAPI** backend,
**SQLAlchemy** ORM, **MySQL** (production) / **SQLite** (dev & tests), JWT auth,
role-based access control, attendance tracking with QR codes, recurring
schedules, and reporting.

## Features

- One-time **church setup wizard** (church profile + super admin account)
- **Dashboard** with stat cards and charts (weekly trend, membership growth,
  attendance per event, upcoming activities)
- **Member management** with categories (youth, children, visitors, new
  converts…), search, profiles, and per-member **QR codes** for check-in
- **Events & activities** with categories, venues, ministries, statuses, and a
  month/week **calendar view**
- **Attendance check-in** — manual status marking (present/absent/late/excused),
  visitor registration, live counters, duplicate-scan protection, CSV export
- **Recurring schedules** (weekly/monthly) with automatic occurrence expansion
  and one-click event generation
- **Ministries & departments** with rosters and leaders
- **Reports** — daily/weekly/monthly attendance, CSV export
- **Automation jobs** — event reminders, absentee flagging, schedule→event
  generation, all logged to `job_logs`
- **Roles**: super_admin, pastor, secretary, attendance_checker, ministry_leader

## Project layout

```
backend/    FastAPI app (app/), tests/, requirements.txt
frontend/   React + Vite + TypeScript SPA
```

## Quick start (local development)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # then edit SECRET_KEY etc.
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger): http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api → :8000)
```

### Database

- **Dev/tests:** SQLite — set `DATABASE_URL=sqlite:///./church.db` (default).
- **Production:** MySQL — `DATABASE_URL=mysql+pymysql://user:pass@host:3306/dbname`.
  Tables are created automatically on startup (`Base.metadata.create_all`).

### First run

1. Open http://localhost:5173 → you'll be redirected to **Church Setup**.
2. Fill in church details + admin account.
3. Log in and start adding members, events, and schedules.

## Automation jobs

Jobs live in `backend/app/tasks/jobs.py` and log to the `job_logs` table.
Run them on a schedule (cron / Task Scheduler / APScheduler), e.g. daily:

```bash
cd backend
.venv/Scripts/python -m app.tasks.jobs
```

Jobs included:
- `event_reminders_job` — logs reminders for events starting within 24h
- `absentee_flag_job` — flags members absent from the last 3 events
- `generate_schedule_events_job` — materializes recurring schedules into events

## Testing

```bash
cd backend
.venv/Scripts/python -m pytest tests -q
```

Tests run against an in-memory SQLite database; no external services needed.

## Docker

```bash
docker compose up --build
```

This starts MySQL, the FastAPI backend (:8000) and the built React frontend
(served by nginx on :8080). Set `SECRET_KEY` and DB credentials via `.env`.

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Church | `GET/PUT /api/church`, `POST /api/church/setup`, `GET /api/church/status` |
| Users | `GET/POST /api/users` (super admin) |
| Members | `GET/POST /api/members`, `GET/PUT/DELETE /api/members/{id}` |
| Ministries | `GET/POST /api/ministries`, member roster endpoints |
| Events | `GET/POST /api/events`, `PUT/DELETE /api/events/{id}` |
| Schedules | `GET/POST /api/schedules`, `GET /api/schedules/occurrences`, `POST /api/schedules/generate-events` |
| Attendance | `POST /api/attendance/mark`, `/qr-scan`, `/visitor`, `GET /api/attendance/report` |
| Dashboard | `GET /api/dashboard/stats`, `/attendance-trend`, `/membership-growth`, `/event-attendance` |

Full interactive docs: `/docs` (Swagger UI) and `/redoc`.

## Roles & permissions

| Capability | super_admin | pastor | secretary | attendance_checker | ministry_leader |
|---|---|---|---|---|---|
| Church setup / users | ✅ | | | | |
| Dashboard & reports | ✅ | ✅ | ✅ | view | view |
| Members CRUD | ✅ | ✅ | ✅ | | view |
| Events CRUD | ✅ | ✅ | ✅ | | |
| Schedules CRUD | ✅ | ✅ | ✅ | | |
| Attendance mark / QR / visitors | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ministries (own) | ✅ | ✅ | ✅ | | ✅ |
