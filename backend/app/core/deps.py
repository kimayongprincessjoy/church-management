from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Member, User, UserRole
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise exc
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise exc
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


def get_church_id(user: User, db: Session) -> int:
    """Resolve the church context for the current user."""
    if user.church_id:
        return user.church_id
    from ..models import Church

    church = db.query(Church).first()
    if not church:
        raise HTTPException(status_code=400, detail="Church is not set up yet")
    return church.id


def resolve_member(db: Session, church_id: int, member_ref: str | int) -> Member:
    """Resolve a member by id or QR token."""
    if str(member_ref).isdigit():
        member = db.get(Member, int(member_ref))
    else:
        member = db.query(Member).filter(Member.qr_token == str(member_ref)).first()
    if not member or member.church_id != church_id:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
