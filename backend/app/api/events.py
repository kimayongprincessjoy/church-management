from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.deps import get_church_id, get_current_user
from ..database import get_db
from ..models import Attendance, ChurchEvent, EventCategory, EventStatus, User, UserRole
from ..schemas import EventCreate, EventRead, EventUpdate

router = APIRouter(prefix="/api/events", tags=["events"])

MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY)
VIEW_ROLES = MANAGE_ROLES + (UserRole.ATTENDANCE_CHECKER, UserRole.MINISTRY_LEADER)


def _check_view(user: User):
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _check_manage(user: User):
    if user.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _validate(body):
    if hasattr(body, "category") and body.category and body.category not in EventCategory.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid category. Allowed: {EventCategory.ALL}")
    status_val = getattr(body, "status", None)
    if status_val and status_val not in EventStatus.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {EventStatus.ALL}")
    if getattr(body, "start_at", None) and getattr(body, "end_at", None) and body.end_at < body.start_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")


def _summary(db: Session, event_id: int) -> dict:
    rows = (
        db.query(Attendance.status, func.count(Attendance.id))
        .filter(Attendance.event_id == event_id)
        .group_by(Attendance.status)
        .all()
    )
    summary = {"present": 0, "absent": 0, "late": 0, "excused": 0, "visitors": 0, "total": 0}
    for status_val, count in rows:
        summary[status_val] = summary.get(status_val, 0) + count
        summary["total"] += count
    # visitors counted separately (member_id is null)
    visitors = (
        db.query(func.count(Attendance.id))
        .filter(Attendance.event_id == event_id, Attendance.member_id.is_(None))
        .scalar() or 0
    )
    summary["visitors"] = visitors
    return summary


def _read(e: ChurchEvent, db: Session) -> EventRead:
    data = {c: getattr(e, c) for c in EventRead.model_fields if c not in ("attendance_summary",) and hasattr(e, c)}
    return EventRead(**data, attendance_summary=_summary(db, e.id))


@router.get("", response_model=list[EventRead])
def list_events(
    upcoming: bool = Query(default=False),
    start: datetime | None = None,
    end: datetime | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_view(user)
    church_id = get_church_id(user, db)
    q = db.query(ChurchEvent).filter(ChurchEvent.church_id == church_id)
    now = datetime.utcnow()
    if upcoming:
        q = q.filter(ChurchEvent.start_at >= now, ChurchEvent.status == EventStatus.SCHEDULED)
    if start:
        q = q.filter(ChurchEvent.start_at >= start)
    if end:
        q = q.filter(ChurchEvent.start_at <= end)
    events = q.order_by(ChurchEvent.start_at).all()
    return [_read(e, db) for e in events]


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    e = db.get(ChurchEvent, event_id)
    if not e or e.church_id != church_id:
        raise HTTPException(status_code=404, detail="Event not found")
    return _read(e, db)


@router.post("", response_model=EventRead, status_code=201)
def create_event(body: EventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    e = ChurchEvent(church_id=church_id, organizer_id=user.id, **body.model_dump(exclude={"organizer_id"}))
    if body.organizer_id:
        e.organizer_id = body.organizer_id
    db.add(e)
    db.commit()
    db.refresh(e)
    return _read(e, db)


@router.put("/{event_id}", response_model=EventRead)
def update_event(
    event_id: int, body: EventUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    e = db.get(ChurchEvent, event_id)
    if not e or e.church_id != church_id:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    db.commit()
    db.refresh(e)
    return _read(e, db)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    church_id = get_church_id(user, db)
    e = db.get(ChurchEvent, event_id)
    if not e or e.church_id != church_id:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(e)
    db.commit()
