from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.deps import get_church_id, get_current_user
from ..database import get_db
from ..models import Member, Ministry, MinistryMember, User, UserRole
from ..schemas import MinistryCreate, MinistryMemberIn, MinistryRead, MinistryUpdate

router = APIRouter(prefix="/api/ministries", tags=["ministries"])

MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY, UserRole.MINISTRY_LEADER)


def _check_manage(user: User, ministry: Ministry | None = None):
    if user.role in (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY):
        return
    if user.role == UserRole.MINISTRY_LEADER and ministry is not None:
        # ministry leaders may only manage ministries they lead
        if ministry.leader_id == user.id:
            return
    raise HTTPException(status_code=403, detail="Insufficient permissions")


def _read(m: Ministry, db: Session) -> MinistryRead:
    count = db.query(func.count(MinistryMember.id)).filter(MinistryMember.ministry_id == m.id).scalar() or 0
    data = {c: getattr(m, c) for c in MinistryRead.model_fields if c != "member_count" and hasattr(m, c)}
    return MinistryRead(**data, member_count=count)


@router.get("", response_model=list[MinistryRead])
def list_ministries(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    q = db.query(Ministry).filter(Ministry.church_id == church_id)
    if user.role == UserRole.MINISTRY_LEADER:
        q = q.filter(Ministry.leader_id == user.id)
    return [_read(m, db) for m in q.order_by(Ministry.name).all()]


@router.get("/{ministry_id}", response_model=MinistryRead)
def get_ministry(ministry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    return _read(m, db)


@router.post("", response_model=MinistryRead, status_code=201)
def create_ministry(body: MinistryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    church_id = get_church_id(user, db)
    m = Ministry(church_id=church_id, **body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _read(m, db)


@router.put("/{ministry_id}", response_model=MinistryRead)
def update_ministry(
    ministry_id: int, body: MinistryUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    _check_manage(user, m)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return _read(m, db)


@router.delete("/{ministry_id}", status_code=204)
def delete_ministry(ministry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    db.delete(m)
    db.commit()


@router.get("/{ministry_id}/members")
def list_ministry_members(ministry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    links = db.query(MinistryMember).filter(MinistryMember.ministry_id == ministry_id).all()
    member_ids = [l.member_id for l in links]
    members = {mb.id: mb for mb in db.query(Member).filter(Member.id.in_(member_ids)).all()} if member_ids else {}
    return [
        {
            "id": l.id,
            "member_id": l.member_id,
            "member_name": members[l.member_id].full_name if l.member_id in members else "Unknown",
            "category": members[l.member_id].category if l.member_id in members else None,
            "role_in_ministry": l.role_in_ministry,
        }
        for l in links
    ]


@router.post("/{ministry_id}/members", status_code=201)
def add_ministry_member(
    ministry_id: int, body: MinistryMemberIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    _check_manage(user, m)
    member = db.get(Member, body.member_id)
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    existing = (
        db.query(MinistryMember)
        .filter(MinistryMember.ministry_id == ministry_id, MinistryMember.member_id == body.member_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Member is already in this ministry")
    link = MinistryMember(ministry_id=ministry_id, member_id=body.member_id, role_in_ministry=body.role_in_ministry)
    db.add(link)
    db.commit()
    return {"id": link.id, "member_id": link.member_id, "role_in_ministry": link.role_in_ministry}


@router.delete("/{ministry_id}/members/{member_id}", status_code=204)
def remove_ministry_member(
    ministry_id: int, member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    church_id = get_church_id(user, db)
    m = db.get(Ministry, ministry_id)
    if not m or m.church_id != church_id:
        raise HTTPException(status_code=404, detail="Ministry not found")
    _check_manage(user, m)
    link = (
        db.query(MinistryMember)
        .filter(MinistryMember.ministry_id == ministry_id, MinistryMember.member_id == member_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Membership link not found")
    db.delete(link)
    db.commit()
