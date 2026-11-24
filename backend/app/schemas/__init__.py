from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Church ----------

class ChurchBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    logo_url: str | None = None
    address: str | None = None
    denomination: str | None = None
    phone: str | None = None
    email: str | None = EmailStr
    pastor_name: str | None = None
    description: str | None = None
    founded_date: date | None = None


class ChurchRead(ChurchBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ChurchSetup(ChurchBase):
    admin_username: str = Field(min_length=3, max_length=100)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)
    admin_full_name: str


# ---------- Auth / Users ----------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    church_id: int | None


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)


# ---------- Members ----------

class MemberBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    category: str = "regular"
    gender: str | None = None
    birthday: date | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    joined_date: date | None = None
    photo_url: str | None = None
    notes: str | None = None


class MemberCreate(MemberBase):
    status: str = "active"


class MemberUpdate(MemberBase):
    status: str | None = None


class MemberRead(MemberBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    church_id: int
    status: str
    qr_token: str
    created_at: datetime
    full_name: str = ""

    @classmethod
    def from_orm_member(cls, m):
        data = {c: getattr(m, c) for c in cls.model_fields if hasattr(m, c) or c == "full_name"}
        data["full_name"] = m.full_name
        return cls(**data)


class MemberListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    full_name: str
    category: str
    status: str
    phone: str | None
    joined_date: date | None
    photo_url: str | None


# ---------- Ministries ----------

class MinistryBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    leader_id: int | None = None
    schedule_info: str | None = None
    is_active: bool = True


class MinistryCreate(MinistryBase):
    pass


class MinistryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    leader_id: int | None = None
    schedule_info: str | None = None
    is_active: bool | None = None


class MinistryMemberIn(BaseModel):
    member_id: int
    role_in_ministry: str | None = None


class MinistryRead(MinistryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    church_id: int
    member_count: int = 0


# ---------- Events ----------

class EventBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    category: str = "other"
    start_at: datetime
    end_at: datetime | None = None
    venue: str | None = None
    ministry_id: int | None = None
    organizer_id: int | None = None
    expected_participants: int | None = None
    status: str = "scheduled"


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    venue: str | None = None
    ministry_id: int | None = None
    organizer_id: int | None = None
    expected_participants: int | None = None
    status: str | None = None


class EventRead(EventBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    church_id: int
    created_at: datetime
    attendance_summary: dict = {}


# ---------- Schedules ----------

class ScheduleBase(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    recurrence: str = "weekly"
    start_time: time | None = None
    end_time: time | None = None
    location: str | None = None
    ministry_id: int | None = None
    responsible_user_id: int | None = None
    is_active: bool = True


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(ScheduleBase):
    pass


class ScheduleRead(ScheduleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    church_id: int


class ScheduleOccurrence(BaseModel):
    schedule_id: int
    name: str
    occurrence_at: datetime
    location: str | None


# ---------- Attendance ----------

class AttendanceMark(BaseModel):
    event_id: int
    member: str  # member id or QR token
    status: str
    remarks: str | None = None


class VisitorAttendance(BaseModel):
    event_id: int
    visitor_name: str = Field(min_length=1, max_length=300)
    status: str = "present"
    remarks: str | None = None


class AttendanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_id: int
    member_id: int | None
    visitor_name: str | None
    status: str
    checked_at: datetime
    remarks: str | None
    member_name: str = ""


class AttendanceSummary(BaseModel):
    present: int = 0
    absent: int = 0
    late: int = 0
    excused: int = 0
    visitors: int = 0
    total: int = 0
