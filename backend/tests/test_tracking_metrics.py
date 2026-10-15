from datetime import date, datetime, time, timezone
from types import SimpleNamespace as NS
from zoneinfo import ZoneInfo

from app.services import tracking_metrics as tm

IST = ZoneInfo("Asia/Kolkata")


def ev(kind):
    return NS(event_type=kind, created_at=datetime.now(timezone.utc), user_id=1)


def test_snooze_reduction():
    current = [ev("triggered")] * 10 + [ev("snoozed")] * 3
    previous = [ev("triggered")] * 10 + [ev("snoozed")] * 6
    assert tm.snooze_reduction_component(current) == 70.0
    assert tm.snooze_reduction_component([]) is None
    assert tm.snooze_summary(current, previous)["snooze_reduction_percent"] == 50.0


def night(hour, minute, duration):
    bed = datetime(2026, 10, 1, hour, minute, tzinfo=IST).astimezone(timezone.utc)
    return NS(bed_time=bed, duration_minutes=duration, quality=4, sleep_date=date(2026, 10, 2))


def test_sleep_adherence():
    assert tm.night_is_on_schedule(night(23, 10, 470), 480, time(23, 0), IST)
    assert not tm.night_is_on_schedule(night(1, 30, 470), 480, time(23, 0), IST)
    assert not tm.night_is_on_schedule(night(23, 0, 300), 480, time(23, 0), IST)
    assert tm.sleep_adherence_component([], 480, time(23, 0), IST) is None


def test_pearson_needs_enough_varied_data():
    assert tm.pearson([1, 0, 1, 0, 1, 0], [8, 3, 9, 4, 7, 2]) > 0.9
    assert tm.pearson([1, 1, 1, 1, 1], [1, 2, 3, 4, 5]) is None
    assert tm.pearson([1, 0], [1, 2]) is None
