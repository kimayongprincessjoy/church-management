from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.deps import get_church_id, get_current_user
from ..database import get_db
from ..models import ChurchEvent, ChurchSchedule, EventCategory, Recurrence, User, UserRole
from ..schemas import ScheduleCreate, ScheduleOccurrence, ScheduleRead, ScheduleUpdate
from ..services.occurrences import upcoming_occurrences

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY)
VIEW_ROLES = MANAGE_ROLES + (UserRole.ATTENDANCE_CHECKER, UserRole.MINISTRY_LEADER)


def _check_view(user: User):
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _check_manage(user: User):
    if user.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _validate(body):
    if getattr(body, "recurrence", None) not in (Recurrence.WEEKLY, Recurrence.MONTHLY):
        raise HTTPException(status_code=400, detail="recurrence must be 'weekly' or 'monthly'")
    if getattr(body, "day_of_week", None) is not None and not (0 <= body.day_of_week <= 6):
        raise HTTPException(status_code=400, detail="day_of_week must be 0 (Monday) to 6 (Sunday)")
    if getattr(body, "recurrence", None) == Recurrence.WEEKLY and getattr(body, "day_of_week", None) is None:
        raise HTTPException(status_code=400, detail="day_of_week is required for weekly schedules")
    if getattr(body, "recurrence", None) == Recurrence.MONTHLY and getattr(body, "day_of_month", None) is None:
        raise HTTPException(status_code=400, detail="day_of_month is required for monthly schedules")


@router.get("", response_model=list[ScheduleRead])
def list_schedules(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    return db.query(ChurchSchedule).filter(ChurchSchedule.church_id == church_id).order_by(ChurchSchedule.name).all()


@router.get("/occurrences", response_model=list[ScheduleOccurrence])
def list_occurrences(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_view(user)
    church_id = get_church_id(user, db)
    schedules = (
        db.query(ChurchSchedule)
        .filter(ChurchSchedule.church_id == church_id, ChurchSchedule.is_active.is_(True))
        .all()
    )
    until = datetime.utcnow() + timedelta(days=days)
    return upcoming_occurrences(schedules, datetime.utcnow(), until)


@router.get("/{schedule_id}", response_model=ScheduleRead)
def get_schedule(schedule_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    s = db.get(ChurchSchedule, schedule_id)
    if not s or s.church_id != church_id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return s


@router.post("", response_model=ScheduleRead, status_code=201)
def create_schedule(body: ScheduleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    s = ChurchSchedule(church_id=church_id, **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{schedule_id}", response_model=ScheduleRead)
def update_schedule(
    schedule_id: int, body: ScheduleUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    s = db.get(ChurchSchedule, schedule_id)
    if not s or s.church_id != church_id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    church_id = get_church_id(user, db)
    s = db.get(ChurchSchedule, schedule_id)
    if not s or s.church_id != church_id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(s)
    db.commit()


@router.post("/generate-events", response_model=dict)
def generate_events(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Materialize upcoming schedule occurrences as church events."""
    _check_manage(user)
    church_id = get_church_id(user, db)
    schedules = (
        db.query(ChurchSchedule)
        .filter(ChurchSchedule.church_id == church_id, ChurchSchedule.is_active.is_(True))
        .all()
    )
    until = datetime.utcnow() + timedelta(days=days)
    occurrences = upcoming_occurrences(schedules, datetime.utcnow(), until)

    created = 0
    skipped = 0
    for occ in occurrences:
        exists = (
            db.query(ChurchEvent)
            .filter(
                ChurchEvent.church_id == church_id,
                ChurchEvent.title == occ.name,
                ChurchEvent.start_at == occ.occurrence_at,
            )
            .first()
        )
        if exists:
            skipped += 1
            continue
        end_at = occ.occurrence_at + timedelta(hours=2)
        db.add(
            ChurchEvent(
                church_id=church_id,
                title=occ.name,
                description=f"Auto-generated from recurring schedule #{occ.schedule_id}",
                category=EventCategory.OTHER,
                start_at=occ.occurrence_at,
                end_at=end_at,
                venue=occ.location,
                status="scheduled",
            )
        )
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}
