import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text,
    Time, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


def gen_id() -> str:
    return uuid.uuid4().hex[:16]


class Church(Base):
    __tablename__ = "churches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(String(500))
    denomination: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    pastor_name: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    founded_date: Mapped[date | None] = mapped_column(Date)

    users: Mapped[list["User"]] = relationship(back_populates="church", cascade="all, delete-orphan")
    members: Mapped[list["Member"]] = relationship(back_populates="church", cascade="all, delete-orphan")


class UserRole:
    SUPER_ADMIN = "super_admin"
    PASTOR = "pastor"
    SECRETARY = "secretary"
    ATTENDANCE_CHECKER = "attendance_checker"
    MINISTRY_LEADER = "ministry_leader"

    ALL = [SUPER_ADMIN, PASTOR, SECRETARY, ATTENDANCE_CHECKER, MINISTRY_LEADER]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int | None] = mapped_column(ForeignKey("churches.id", ondelete="SET NULL"), index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default=UserRole.ATTENDANCE_CHECKER, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    church: Mapped[Church | None] = relationship(back_populates="users")


class MemberCategory:
    REGULAR = "regular"
    YOUTH = "youth"
    CHILDREN = "children"
    CHURCH_WORKER = "church_worker"
    MINISTRY_LEADER = "ministry_leader"
    VISITOR = "visitor"
    NEW_CONVERT = "new_convert"

    ALL = [REGULAR, YOUTH, CHILDREN, CHURCH_WORKER, MINISTRY_LEADER, VISITOR, NEW_CONVERT]


class MemberStatus:
    ACTIVE = "active"
    INACTIVE = "inactive"
    DECEASED = "deceased"
    TRANSFERRED = "transferred"

    ALL = [ACTIVE, INACTIVE, DECEASED, TRANSFERRED]


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int] = mapped_column(ForeignKey("churches.id", ondelete="CASCADE"), index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), default=MemberCategory.REGULAR, index=True)
    status: Mapped[str] = mapped_column(String(50), default=MemberStatus.ACTIVE, index=True)
    gender: Mapped[str | None] = mapped_column(String(20))
    birthday: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(String(500))
    emergency_contact: Mapped[str | None] = mapped_column(String(300))
    joined_date: Mapped[date | None] = mapped_column(Date)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=gen_id, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    church: Mapped[Church] = relationship(back_populates="members")
    ministry_links: Mapped[list["MinistryMember"]] = relationship(back_populates="member", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Ministry(Base):
    __tablename__ = "ministries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int] = mapped_column(ForeignKey("churches.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    leader_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    schedule_info: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    member_links: Mapped[list["MinistryMember"]] = relationship(back_populates="ministry", cascade="all, delete-orphan")


class MinistryMember(Base):
    __tablename__ = "ministry_members"
    __table_args__ = (UniqueConstraint("ministry_id", "member_id", name="uq_ministry_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ministry_id: Mapped[int] = mapped_column(ForeignKey("ministries.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    role_in_ministry: Mapped[str | None] = mapped_column(String(100))

    ministry: Mapped[Ministry] = relationship(back_populates="member_links")
    member: Mapped[Member] = relationship(back_populates="ministry_links")


class EventCategory:
    WORSHIP = "worship"
    FELLOWSHIP = "fellowship"
    STUDY = "study"
    PRAYER = "prayer"
    OUTREACH = "outreach"
    TRAINING = "training"
    SPECIAL = "special"
    OTHER = "other"

    ALL = [WORSHIP, FELLOWSHIP, STUDY, PRAYER, OUTREACH, TRAINING, SPECIAL, OTHER]


class EventStatus:
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    POSTPONED = "postponed"

    ALL = [SCHEDULED, CANCELLED, COMPLETED, POSTPONED]


class ChurchEvent(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int] = mapped_column(ForeignKey("churches.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), default=EventCategory.OTHER, index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime)
    venue: Mapped[str | None] = mapped_column(String(300))
    ministry_id: Mapped[int | None] = mapped_column(ForeignKey("ministries.id", ondelete="SET NULL"))
    organizer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expected_participants: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default=EventStatus.SCHEDULED, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Recurrence:
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ChurchSchedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int] = mapped_column(ForeignKey("churches.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    day_of_week: Mapped[int | None] = mapped_column(Integer)  # 0=Monday..6=Sunday, None for monthly
    day_of_month: Mapped[int | None] = mapped_column(Integer)
    recurrence: Mapped[str] = mapped_column(String(20), default=Recurrence.WEEKLY)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    location: Mapped[str | None] = mapped_column(String(300))
    ministry_id: Mapped[int | None] = mapped_column(ForeignKey("ministries.id", ondelete="SET NULL"))
    responsible_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AttendanceStatus:
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"

    ALL = [PRESENT, ABSENT, LATE, EXCUSED]


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("event_id", "member_id", name="uq_event_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    church_id: Mapped[int] = mapped_column(ForeignKey("churches.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    visitor_name: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), index=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    remarks: Mapped[str | None] = mapped_column(String(500))

    event: Mapped[ChurchEvent] = relationship()
    member: Mapped[Member | None] = relationship()


class JobLog(Base):
    __tablename__ = "job_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_name: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20))  # success | failed
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
