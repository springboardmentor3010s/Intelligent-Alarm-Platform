from datetime import datetime, time, timezone
from types import SimpleNamespace as NS
from zoneinfo import ZoneInfo

from app.services import alarm_service as svc

IST = ZoneInfo("Asia/Kolkata")
SUNDAY_0730_IST = datetime(2026, 10, 11, 2, 0, tzinfo=timezone.utc)


def test_weekday_alarm_skips_the_weekend():
    nxt = svc.next_occurrence("weekdays", time(7, 0), IST, SUNDAY_0730_IST)
    assert nxt.weekday() == 0 and nxt.day == 12


def test_daily_alarm_rolls_to_tomorrow_when_time_has_passed():
    assert svc.next_occurrence("daily", time(7, 0), IST, SUNDAY_0730_IST).day == 12
    assert svc.next_occurrence("daily", time(8, 0), IST, SUNDAY_0730_IST).day == 11


def test_time_helpers_wrap_midnight():
    assert svc.minutes_between(time(23, 0), time(7, 0)) == 480
    assert svc.shift_time(time(7, 0), -480) == time(23, 0)


def test_smart_suggestion_limits_snoozing_for_frequent_snoozers():
    profile = NS(daily_sleep_goal_minutes=480, wake_target=time(7, 0),
                 sleep_target=time(0, 30), preferred_challenge="logic",
                 current_difficulty="easy")
    result = svc.build_smart_suggestion(profile, 2.5, "medium")
    assert result["snooze_limit"] == 0
    assert result["bedtime"] == "23:00"
    assert result["difficulty"] == "medium"
