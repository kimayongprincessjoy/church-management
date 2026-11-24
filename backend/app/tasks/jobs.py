"""Background automation jobs: reminders, absentee flags, report generation."""
import logging
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Attendance, AttendanceStatus, ChurchEvent, EventStatus, JobLog, Member,
    MemberStatus,
)
from .occurrences import upcoming_occurrences
from ..models import ChurchSchedule

logger = logging.getLogger(__name__)


def _log(db: Session, job_name: str, status: str, message: str):
    db.add(JobLog(job_name=job_name, status=status, message=message))
    db.commit()


def event_reminders_job():
    """Log reminders for events starting within 24h (extend to email/notify later)."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        horizon = now + timedelta(hours=24)
        events = (
            db.query(ChurchEvent)
            .filter(ChurchEvent.start_at >= now, ChurchEvent.start_at <= horizon,
                    ChurchEvent.status == EventStatus.SCHEDULED)
            .all()
        )
        for e in events:
            _log(db, "event_reminder", "success",
                 f"Reminder: '{e.title}' starts {e.start_at.isoformat()}")
        if not events:
            _log(db, "event_reminder", "success", "No upcoming events within 24h")
    except Exception as exc:  # noqa: BLE001
        logger.exception("event_reminders_job failed")
        _log(db, "event_reminder", "failed", str(exc))
    finally:
        db.close()


def absentee_flag_job(consecutive_misses: int = 3):
    """Flag active members absent from the last N scheduled events."""
    db = SessionLocal()
    try:
        events = (
            db.query(ChurchEvent)
            .filter(ChurchEvent.status == EventStatus.SCHEDULED,
                    ChurchEvent.start_at <= datetime.utcnow())
            .order_by(ChurchEvent.start_at.desc())
            .limit(consecutive_misses)
            .all()
        )
        if len(events) < consecutive_misses:
            _log(db, "absentee_flag", "success", "Not enough past events to evaluate")
            return
        event_ids = [e.id for e in events]
        flagged = 0
        members = db.query(Member).filter(Member.status == MemberStatus.ACTIVE).all()
        for m in members:
            present = (
                db.query(func.count(Attendance.id))
                .filter(Attendance.member_id == m.id,
                        Attendance.event_id.in_(event_ids),
                        Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]))
                .scalar() or 0
            )
            if present == 0:
                _log(db, "absentee_flag", "success",
                     f"Member #{m.id} {m.full_name} absent from last {consecutive_misses} events")
                flagged += 1
        _log(db, "absentee_flag", "success", f"Flagged {flagged} members")
    except Exception as exc:  # noqa: BLE001
        logger.exception("absentee_flag_job failed")
        _log(db, "absentee_flag", "failed", str(exc))
    finally:
        db.close()


def generate_schedule_events_job(days: int = 30):
    """Auto-generate events from active recurring schedules."""
    db = SessionLocal()
    try:
        schedules = db.query(ChurchSchedule).filter(ChurchSchedule.is_active.is_(True)).all()
        by_church: dict[int, list] = {}
        for s in schedules:
            by_church.setdefault(s.church_id, []).append(s)
        total_created = 0
        for church_id, church_schedules in by_church.items():
            occurrences = upcoming_occurrences(
                church_schedules, datetime.utcnow(), datetime.utcnow() + timedelta(days=days)
            )
            for occ in occurrences:
                exists = (
                    db.query(ChurchEvent)
                    .filter(ChurchEvent.church_id == church_id,
                            ChurchEvent.title == occ.name,
                            ChurchEvent.start_at == occ.occurrence_at)
                    .first()
                )
                if not exists:
                    db.add(ChurchEvent(
                        church_id=church_id, title=occ.name,
                        description="Auto-generated from recurring schedule",
                        start_at=occ.occurrence_at,
                        end_at=occ.occurrence_at + timedelta(hours=2),
                        venue=occ.location, status=EventStatus.SCHEDULED,
                    ))
                    total_created += 1
        db.commit()
        _log(db, "generate_schedule_events", "success", f"Created {total_created} events")
    except Exception as exc:  # noqa: BLE001
        logger.exception("generate_schedule_events_job failed")
        db.rollback()
        _log(db, "generate_schedule_events", "failed", str(exc))
    finally:
        db.close()


def run_all_jobs():
    event_reminders_job()
    absentee_flag_job()
    generate_schedule_events_job()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_all_jobs()
