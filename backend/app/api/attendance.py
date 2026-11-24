import csv
import io
from datetime import datetime, timedelta

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..core.deps import get_church_id, get_current_user, resolve_member
from ..database import get_db
from ..models import (
    Attendance, AttendanceStatus, ChurchEvent, EventStatus, Member, User, UserRole,
)
from ..schemas import AttendanceMark, AttendanceRead, AttendanceSummary, VisitorAttendance

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

CHECK_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY,
               UserRole.ATTENDANCE_CHECKER, UserRole.MINISTRY_LEADER)
EDIT_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY)


def _check_view(user: User):
    if user.role not in CHECK_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _check_edit(user: User):
    if user.role not in EDIT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _get_event(db: Session, church_id: int, event_id: int) -> ChurchEvent:
    e = db.get(ChurchEvent, event_id)
    if not e or e.church_id != church_id:
        raise HTTPException(status_code=404, detail="Event not found")
    return e


def _validate_status(status_val: str):
    if status_val not in AttendanceStatus.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {AttendanceStatus.ALL}")


def _to_read(a: Attendance, db: Session) -> AttendanceRead:
    name = a.member.full_name if a.member else (a.visitor_name or "")
    data = {c: getattr(a, c) for c in AttendanceRead.model_fields if c != "member_name" and hasattr(a, c)}
    return AttendanceRead(**data, member_name=name)


@router.get("/events/{event_id}", response_model=list[AttendanceRead])
def list_event_attendance(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _check_view(user)
    church_id = get_church_id(user, db)
    _get_event(db, church_id, event_id)
    records = db.query(Attendance).filter(Attendance.event_id == event_id).all()
    return [_to_read(a, db) for a in records]


@router.post("/mark", response_model=AttendanceRead, status_code=201)
def mark_attendance(body: AttendanceMark, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Manual or QR attendance check-in. Upserts by (event, member)."""
    _check_view(user)
    church_id = get_church_id(user, db)
    _validate_status(body.status)
    _get_event(db, church_id, body.event_id)
    member = resolve_member(db, church_id, body.member)

    existing = (
        db.query(Attendance)
        .filter(Attendance.event_id == body.event_id, Attendance.member_id == member.id)
        .first()
    )
    if existing:
        # QR duplicate scans return the existing record; manual edits need edit role
        if body.status != existing.status and user.role not in EDIT_ROLES:
            raise HTTPException(status_code=409, detail="Already recorded; editing requires elevated role")
        existing.status = body.status
        existing.remarks = body.remarks or existing.remarks
        existing.checked_at = datetime.utcnow()
        existing.recorded_by = user.id
        db.commit()
        db.refresh(existing)
        return _to_read(existing, db)

    record = Attendance(
        church_id=church_id, event_id=body.event_id, member_id=member.id,
        status=body.status, recorded_by=user.id, remarks=body.remarks,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_read(record, db)


@router.post("/qr-scan", response_model=AttendanceRead, status_code=201)
def qr_scan(body: AttendanceMark, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """QR code attendance: always marks 'present', never changes an existing record."""
    _check_view(user)
    church_id = get_church_id(user, db)
    _get_event(db, church_id, body.event_id)
    member = resolve_member(db, church_id, body.member)

    existing = (
        db.query(Attendance)
        .filter(Attendance.event_id == body.event_id, Attendance.member_id == member.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already recorded for this event")
    record = Attendance(
        church_id=church_id, event_id=body.event_id, member_id=member.id,
        status=AttendanceStatus.PRESENT, recorded_by=user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_read(record, db)


@router.post("/visitor", response_model=AttendanceRead, status_code=201)
def add_visitor(body: VisitorAttendance, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    _validate_status(body.status)
    _get_event(db, church_id, body.event_id)
    record = Attendance(
        church_id=church_id, event_id=body.event_id, member_id=None,
        visitor_name=body.visitor_name, status=body.status,
        recorded_by=user.id, remarks=body.remarks,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_read(record, db)


@router.put("/{attendance_id}", response_model=AttendanceRead)
def edit_attendance(
    attendance_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _check_edit(user)
    church_id = get_church_id(user, db)
    record = db.get(Attendance, attendance_id)
    if not record or record.church_id != church_id:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if "status" in body:
        _validate_status(body["status"])
        record.status = body["status"]
    if "remarks" in body:
        record.remarks = body["remarks"]
    record.checked_at = datetime.utcnow()
    record.recorded_by = user.id
    db.commit()
    db.refresh(record)
    return _to_read(record, db)


@router.get("/summary/{event_id}", response_model=AttendanceSummary)
def attendance_summary(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    _get_event(db, church_id, event_id)
    rows = (
        db.query(Attendance.status, func.count(Attendance.id))
        .filter(Attendance.event_id == event_id)
        .group_by(Attendance.status)
        .all()
    )
    summary = AttendanceSummary()
    for status_val, count in rows:
        setattr(summary, status_val, count)
        summary.total += count
    summary.visitors = (
        db.query(func.count(Attendance.id))
        .filter(Attendance.event_id == event_id, Attendance.member_id.is_(None))
        .scalar() or 0
    )
    return summary


@router.get("/report")
def attendance_report(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    event_id: int | None = None,
    format: str = Query(default="json", pattern="^(json|csv)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Daily/weekly/monthly attendance report. CSV export supported."""
    _check_view(user)
    church_id = get_church_id(user, db)
    if not start:
        start = datetime.utcnow() - timedelta(days=30)
    if not end:
        end = datetime.utcnow()
    q = db.query(Attendance).filter(
        Attendance.church_id == church_id,
        Attendance.checked_at >= start,
        Attendance.checked_at <= end,
    )
    if event_id:
        q = q.filter(Attendance.event_id == event_id)
    records = q.order_by(Attendance.checked_at).all()

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["date", "event_id", "member", "visitor", "status", "remarks"])
        for a in records:
            writer.writerow([
                a.checked_at.date().isoformat(), a.event_id,
                a.member.full_name if a.member else "", a.visitor_name or "",
                a.status, a.remarks or "",
            ])
        return Response(
            content=buf.getvalue(), media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=attendance_report.csv"},
        )
    return [_to_read(a, db) for a in records]


@router.get("/member-qr/{member_id}.png")
def member_qr(member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return a QR code PNG encoding the member's check-in URL/token."""
    _check_view(user)
    church_id = get_church_id(user, db)
    member = db.get(Member, member_id)
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    payload = f"{settings.public_base_url}/checkin?token={member.qr_token}"
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
