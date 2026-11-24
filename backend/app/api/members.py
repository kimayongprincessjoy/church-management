from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.deps import get_church_id, get_current_user
from ..database import get_db
from ..models import Member, MemberCategory, MemberStatus, User, UserRole
from ..schemas import MemberCreate, MemberListItem, MemberRead, MemberUpdate

router = APIRouter(prefix="/api/members", tags=["members"])

MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY)
VIEW_ROLES = MANAGE_ROLES + (UserRole.MINISTRY_LEADER,)


def _check_view(user: User):
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _check_manage(user: User):
    if user.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _validate(body):
    if hasattr(body, "category") and body.category and body.category not in MemberCategory.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid category. Allowed: {MemberCategory.ALL}")
    status_val = getattr(body, "status", None)
    if status_val and status_val not in MemberStatus.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {MemberStatus.ALL}")


@router.get("", response_model=list[MemberListItem])
def list_members(
    search: str | None = Query(default=None),
    category: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_view(user)
    church_id = get_church_id(user, db)
    q = db.query(Member).filter(Member.church_id == church_id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Member.first_name.like(like), Member.last_name.like(like), Member.phone.like(like)))
    if category:
        q = q.filter(Member.category == category)
    if status:
        q = q.filter(Member.status == status)
    members = q.order_by(Member.last_name, Member.first_name).all()
    return [
        MemberListItem(
            id=m.id, first_name=m.first_name, last_name=m.last_name, full_name=m.full_name,
            category=m.category, status=m.status, phone=m.phone,
            joined_date=m.joined_date, photo_url=m.photo_url,
        )
        for m in members
    ]


@router.get("/{member_id}", response_model=MemberRead)
def get_member(member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_view(user)
    church_id = get_church_id(user, db)
    member = db.get(Member, member_id)
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    data = {c: getattr(member, c) for c in MemberRead.model_fields if c != "full_name" and hasattr(member, c)}
    data["full_name"] = member.full_name
    return MemberRead(**data)


@router.post("", response_model=MemberRead, status_code=201)
def create_member(body: MemberCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    member = Member(church_id=church_id, **body.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return get_member(member.id, user, db)


@router.put("/{member_id}", response_model=MemberRead)
def update_member(
    member_id: int, body: MemberUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _check_manage(user)
    _validate(body)
    church_id = get_church_id(user, db)
    member = db.get(Member, member_id)
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return get_member(member.id, user, db)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super administrator only")
    church_id = get_church_id(user, db)
    member = db.get(Member, member_id)
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()


@router.get("/lookup/qr/{token}")
def lookup_qr(token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    member = db.query(Member).filter(Member.qr_token == token, Member.church_id == church_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Unknown QR code")
    return {"id": member.id, "full_name": member.full_name, "category": member.category, "status": member.status}
