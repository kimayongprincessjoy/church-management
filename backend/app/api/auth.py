from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core.deps import get_current_user, get_church_id
from ..core.security import create_access_token, hash_password, verify_password
from ..database import get_db
from ..models import Church, User, UserRole
from ..schemas import ChurchRead, LoginRequest, Token, UserCreate, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/users", tags=["users"])


def _token_for(user: User) -> Token:
    return Token(access_token=create_access_token(str(user.id), {"role": user.role}))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return _token_for(user)


@router.post("/login/json", response_model=Token)
def login_json(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return _token_for(user)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/church", response_model=ChurchRead | None)
def current_church(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    church_id = get_church_id(user, db)
    return db.get(Church, church_id)


# ---------- User management (super admin only) ----------

@users_router.get("", response_model=list[UserRead])
def list_users(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super administrator only")
    return db.query(User).filter(User.church_id == user.church_id).all()


@users_router.post("", response_model=UserRead, status_code=201)
def create_user(
    body: UserCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super administrator only")
    if body.role not in UserRole.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {UserRole.ALL}")
    if db.query(User).filter((User.username == body.username) | (User.email == body.email)).first():
        raise HTTPException(status_code=409, detail="Username or email already exists")
    new_user = User(
        church_id=user.church_id,
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
