"""All datetimes are stored as naive UTC. Helpers keep that consistent."""
from datetime import datetime, timezone, date, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_tz(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return ZoneInfo("UTC")


def local_now(tz_name: str, now_utc: datetime | None = None) -> datetime:
    now_utc = now_utc or utcnow()
    return now_utc.replace(tzinfo=timezone.utc).astimezone(get_tz(tz_name))


def local_to_utc(d: date, t: time, tz_name: str) -> datetime:
    """Wall-clock local date+time -> naive UTC."""
    aware = datetime.combine(d, t).replace(tzinfo=get_tz(tz_name))
    return aware.astimezone(timezone.utc).replace(tzinfo=None)


def utc_to_local(dt: datetime, tz_name: str) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(get_tz(tz_name))
