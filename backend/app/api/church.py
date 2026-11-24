from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.deps import get_current_user, get_church_id
from ..core.security import hash_password
from ..database import get_db
from ..models import Church, User, UserRole
from ..schemas import ChurchRead, ChurchSetup

router = APIRouter(prefix="/api/church", tags=["church"])


@router.get("/status")
def setup_status(db: Session = Depends(get_db)):
    """Public: whether initial church setup has been completed."""
    return {"configured": db.query(Church).count() > 0}


@router.get("", response_model=ChurchRead | None)
def get_church(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    return db.get(Church, church_id)


@router.put("", response_model=ChurchRead)
def update_church(
    body: ChurchRead,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in (UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.SECRETARY):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    church_id = get_church_id(user, db)
    church = db.get(Church, church_id)
    for field, value in body.model_dump().items():
        if field != "id":
            setattr(church, field, value)
    db.commit()
    db.refresh(church)
    return church


@router.post("/setup", response_model=ChurchRead, status_code=201)
def church_setup(body: ChurchSetup, db: Session = Depends(get_db)):
    """One-time church setup: creates the church plus the super admin account."""
    if db.query(Church).count() > 0:
        raise HTTPException(status_code=409, detail="Church is already set up")
    if db.query(User).filter(User.username == body.admin_username).first():
        raise HTTPException(status_code=409, detail="Admin username already exists")

    church = Church(
        name=body.name,
        logo_url=body.logo_url,
        address=body.address,
        denomination=body.denomination,
        phone=body.phone,
        email=body.email,
        pastor_name=body.pastor_name,
        description=body.description,
        founded_date=body.founded_date,
    )
    db.add(church)
    db.flush()

    admin = User(
        church_id=church.id,
        username=body.admin_username,
        email=body.admin_email,
        full_name=body.admin_full_name,
        hashed_password=hash_password(body.admin_password),
        role=UserRole.SUPER_ADMIN,
    )
    db.add(admin)
    db.commit()
    db.refresh(church)
    return church
