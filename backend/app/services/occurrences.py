from datetime import datetime, timedelta

from ..models import ChurchSchedule, Recurrence
from ..schemas import ScheduleOccurrence


def upcoming_occurrences(
    schedules: list[ChurchSchedule], start: datetime, until: datetime
) -> list[ScheduleOccurrence]:
    """Expand active schedules into concrete occurrence datetimes."""
    results: list[ScheduleOccurrence] = []
    for s in schedules:
        if s.recurrence == Recurrence.WEEKLY and s.day_of_week is not None:
            # find first occurrence on/after start
            days_ahead = (s.day_of_week - start.weekday()) % 7
            cursor = start + timedelta(days=days_ahead)
            cursor = cursor.replace(hour=s.start_time.hour if s.start_time else 0,
                                    minute=s.start_time.minute if s.start_time else 0,
                                    second=0, microsecond=0)
            if cursor < start:
                cursor += timedelta(days=7)
            while cursor <= until:
                results.append(ScheduleOccurrence(
                    schedule_id=s.id, name=s.name, occurrence_at=cursor, location=s.location
                ))
                cursor += timedelta(days=7)
        elif s.recurrence == Recurrence.MONTHLY and s.day_of_month is not None:
            year, month = start.year, start.month
            while True:
                day = min(s.day_of_month, _days_in_month(year, month))
                occ = datetime(year, month, day,
                               s.start_time.hour if s.start_time else 0,
                               s.start_time.minute if s.start_time else 0)
                if occ >= until:
                    break
                if occ >= start:
                    results.append(ScheduleOccurrence(
                        schedule_id=s.id, name=s.name, occurrence_at=occ, location=s.location
                    ))
                year, month = _next_month(year, month)
    results.sort(key=lambda o: o.occurrence_at)
    return results


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    return (datetime(year, month + 1, 1) - datetime(year, month, 1)).days


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)
