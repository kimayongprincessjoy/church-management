from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.deps import get_church_id, get_current_user
from ..database import get_db
from ..models import (
    Attendance, AttendanceStatus, ChurchEvent, ChurchSchedule, Member,
    MemberStatus, User,
)
from ..services.occurrences import upcoming_occurrences

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _range(start: datetime, end: datetime, db: Session, church_id: int):
    return (
        db.query(Attendance)
        .filter(Attendance.church_id == church_id,
                Attendance.checked_at >= start, Attendance.checked_at <= end)
        .all()
    )


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)
    week_start = today_start - timedelta(days=today_start.weekday())

    total_members = db.query(func.count(Member.id)).filter(Member.church_id == church_id).scalar() or 0
    active_members = (
        db.query(func.count(Member.id))
        .filter(Member.church_id == church_id, Member.status == MemberStatus.ACTIVE)
        .scalar() or 0
    )
    upcoming_events = (
        db.query(func.count(ChurchEvent.id))
        .filter(ChurchEvent.church_id == church_id,
                ChurchEvent.start_at >= now, ChurchEvent.status == "scheduled")
        .scalar() or 0
    )
    events_this_month = (
        db.query(func.count(ChurchEvent.id))
        .filter(ChurchEvent.church_id == church_id,
                ChurchEvent.start_at >= month_start,
                ChurchEvent.start_at < month_start + timedelta(days=32))
        .scalar() or 0
    )
    new_members_month = (
        db.query(func.count(Member.id))
        .filter(Member.church_id == church_id,
                Member.joined_date >= month_start.date())
        .scalar() or 0
    )

    today_records = _range(today_start, now, db, church_id)
    present_today = sum(1 for a in today_records if a.status == AttendanceStatus.PRESENT)

    weekly = _range(week_start, now, db, church_id)
    weekly_present = sum(1 for a in weekly if a.status == AttendanceStatus.PRESENT)
    # average over worship events this week
    worship_events = (
        db.query(func.count(func.distinct(Attendance.event_id)))
        .filter(Attendance.church_id == church_id,
                Attendance.checked_at >= week_start,
                Attendance.status == AttendanceStatus.PRESENT)
        .scalar() or 0
    )
    avg_weekly = round(weekly_present / worship_events, 1) if worship_events else 0

    schedules = (
        db.query(ChurchSchedule)
        .filter(ChurchSchedule.church_id == church_id, ChurchSchedule.is_active.is_(True))
        .all()
    )
    upcoming_activities = upcoming_occurrences(schedules, now, now + timedelta(days=14))[:10]

    return {
        "total_members": total_members,
        "active_members": active_members,
        "upcoming_events": upcoming_events,
        "events_this_month": events_this_month,
        "attendance_today": present_today,
        "average_weekly_attendance": avg_weekly,
        "new_members_this_month": new_members_month,
        "upcoming_activities": [
            {"schedule_id": o.schedule_id, "name": o.name,
             "occurrence_at": o.occurrence_at.isoformat(), "location": o.location}
            for o in upcoming_activities
        ],
    }


@router.get("/attendance-trend")
def attendance_trend(
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Daily present counts for charts."""
    church_id = get_church_id(user, db)
    start = datetime.utcnow() - timedelta(days=days)
    records = _range(start, datetime.utcnow(), db, church_id)
    by_day: dict[str, dict[str, int]] = {}
    for a in records:
        day = a.checked_at.date().isoformat()
        by_day.setdefault(day, {})[a.status] = by_day.setdefault(day, {}).get(a.status, 0) + 1
    return [
        {"date": day, **counts}
        for day, counts in sorted(by_day.items())
    ]


@router.get("/membership-growth")
def membership_growth(
    months: int = Query(default=12, ge=1, le=60),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    church_id = get_church_id(user, db)
    members = db.query(Member).filter(Member.church_id == church_id).all()
    buckets: dict[str, int] = {}
    for m in members:
        if m.joined_date:
            key = m.joined_date.strftime("%Y-%m")
            buckets[key] = buckets.get(key, 0) + 1
    return [{"month": k, "new_members": v} for k, v in sorted(buckets.items())]


@router.get("/event-attendance")
def event_attendance(
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Present-count per event for the bar chart."""
    church_id = get_church_id(user, db)
    rows = (
        db.query(ChurchEvent.id, ChurchEvent.title, ChurchEvent.start_at,
                 func.count(Attendance.id).label("present"))
        .outerjoin(
            Attendance,
            (Attendance.event_id == ChurchEvent.id)
            & (Attendance.status == AttendanceStatus.PRESENT),
        )
        .filter(ChurchEvent.church_id == church_id)
        .group_by(ChurchEvent.id)
        .order_by(ChurchEvent.start_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"event_id": r.id, "title": r.title,
         "start_at": r.start_at.isoformat() if r.start_at else None,
         "present": r.present or 0}
        for r in rows
    ]
