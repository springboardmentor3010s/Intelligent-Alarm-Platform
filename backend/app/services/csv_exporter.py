import csv
import io
from typing import Any, Dict


def generate_csv_report(data: Dict[str, Any]) -> io.BytesIO:
    """
    Generates a structured, highly readable CSV report using Python's standard csv module.
    Sections are clearly separated with headers and key-value tables.
    Returns an in-memory BytesIO buffer with UTF-8-SIG encoding for universal compatibility.
    """
    string_io = io.StringIO()
    writer = csv.writer(string_io, lineterminator="\n")

    # 1. Metadata / Header
    if data.get("is_demo"):
        writer.writerow(["*** DEMO REPORT — SAMPLE DATA (READ-ONLY) ***"])
        writer.writerow([])

    writer.writerow(["INTELLIGENT COGNITIVE ALARM — PERFORMANCE REPORT"])
    writer.writerow([])
    writer.writerow(["Report Section", "Metadata"])
    writer.writerow(["User Name", data.get("user_name", "User")])
    writer.writerow(["User Email", data.get("user_email", "N/A")])
    writer.writerow(["Generated At", data.get("generated_at", "N/A")])
    writer.writerow(["Report Type", "Milestone 4 — Phase 1 Performance Report"])
    writer.writerow([])

    # 2. Habit Performance
    habit = data.get("habit_report", {})
    writer.writerow(["--- 1. HABIT PERFORMANCE & CONSISTENCY ---"])
    writer.writerow(["Metric", "Score / Value", "Unit / Scale"])
    writer.writerow(["Overall Habit Score", f"{habit.get('overall_habit_score', 0):.1f}", "Score (0 - 100)"])
    writer.writerow(["Wake-Up Consistency", f"{habit.get('wake_up_consistency', 0):.1f}%", "Percentage (%)"])
    writer.writerow(["Challenge Completion", f"{habit.get('challenge_completion', 0):.1f}%", "Percentage (%)"])
    writer.writerow(["Snooze Reduction", f"{habit.get('snooze_reduction', 0):.1f}", "Score (0 - 100)"])
    writer.writerow(["Sleep Schedule Adherence", f"{habit.get('sleep_schedule_adherence', 0):.1f}%", "Percentage (%)"])
    writer.writerow(["Sessions Evaluated", habit.get("sessions_evaluated", 0), "Count"])
    writer.writerow(["Average Snooze Count", f"{habit.get('average_snooze_count', 0):.2f}", "Snoozes per session"])
    writer.writerow([])

    # 3. Wake-Up Performance
    wake = data.get("wake_up_report", {})
    writer.writerow(["--- 2. WAKE-UP PERFORMANCE ---"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Sessions", wake.get("total_sessions", 0)])
    writer.writerow(["Wake-Up Consistency", f"{wake.get('wake_up_consistency', 0):.1f}%"])
    writer.writerow(["Average Response Time", f"{wake.get('average_response_time', 0):.1f} s"])
    writer.writerow(["Successful Dismissals", wake.get("successful_dismissals", 0)])
    writer.writerow(["Total Snoozes Used", wake.get("total_snoozes", 0)])
    writer.writerow([])
    writer.writerow(["Session Status Breakdown", "Count"])
    status_bd = wake.get("status_breakdown", {})
    if status_bd:
        for status_name, count in sorted(status_bd.items()):
            writer.writerow([status_name.capitalize(), count])
    else:
        writer.writerow(["No sessions", 0])
    writer.writerow([])

    # 4. Cognitive Challenge Performance
    challenge = data.get("challenge_report", {})
    writer.writerow(["--- 3. COGNITIVE CHALLENGE PERFORMANCE ---"])
    writer.writerow(["Challenge Overview Metric", "Value"])
    writer.writerow(["Total Challenges", challenge.get("total_challenges", 0)])
    writer.writerow(["Completed Challenges", challenge.get("completed_challenges", 0)])
    writer.writerow(["Correct Answers", challenge.get("correct_answers", 0)])
    writer.writerow(["Incorrect Answers", challenge.get("incorrect_answers", 0)])
    writer.writerow(["Completion Percentage", f"{challenge.get('completion_percentage', 0):.1f}%"])
    writer.writerow(["Accuracy Percentage", f"{challenge.get('accuracy_percentage', 0):.1f}%"])
    writer.writerow(["Average Response Time", f"{challenge.get('average_response_time', 0):.1f} s"])
    writer.writerow([])

    writer.writerow(["Challenge Type Breakdown"])
    writer.writerow(["Type", "Total", "Correct", "Incorrect", "Accuracy (%)"])
    for t in challenge.get("challenge_types", []):
        writer.writerow([
            t.get("challenge_type", ""),
            t.get("total", 0),
            t.get("correct", 0),
            t.get("incorrect", 0),
            f"{t.get('accuracy', 0):.1f}%",
        ])
    writer.writerow([])

    writer.writerow(["Difficulty Level Breakdown"])
    writer.writerow(["Difficulty", "Total", "Correct", "Incorrect", "Accuracy (%)"])
    for d in challenge.get("difficulty_levels", []):
        writer.writerow([
            d.get("difficulty", ""),
            d.get("total", 0),
            d.get("correct", 0),
            d.get("incorrect", 0),
            f"{d.get('accuracy', 0):.1f}%",
        ])
    writer.writerow([])

    # 5. Sleep & Schedule Adherence
    sleep = data.get("sleep_adherence_report", {})
    writer.writerow(["--- 4. SLEEP & SCHEDULE ADHERENCE ---"])
    writer.writerow(["Parameter", "Details / Value"])
    writer.writerow(["Preferred Wake Time", str(sleep.get("preferred_wake_time", "Not available"))])
    writer.writerow(["Target Sleep Duration", str(sleep.get("sleep_duration", "Not available"))])
    writer.writerow(["Sleep Schedule Adherence", f"{sleep.get('sleep_schedule_adherence', 0):.1f}%"])
    writer.writerow(["Schedule Alignment", str(sleep.get("schedule_alignment", "Not available"))])
    writer.writerow(["Profile Data Configured", "Yes" if sleep.get("has_profile_data") else "No"])
    writer.writerow([])

    # 6. Productivity Report
    prod = data.get("productivity_report", {})
    writer.writerow(["--- 5. PRODUCTIVITY REPORT ---"])
    writer.writerow(["Parameter", "Details"])
    writer.writerow(["Productivity Data Available", "Yes" if prod.get("has_productivity_data") else "No"])
    writer.writerow(["Status", str(prod.get("status", "Not available"))])
    writer.writerow(["Productivity Goals", str(prod.get("productivity_goals") or "Productivity data is not available yet.")])
    writer.writerow(["Message", str(prod.get("message", "Productivity data is not available yet."))])

    # Convert to UTF-8-SIG bytes
    encoded_bytes = string_io.getvalue().encode("utf-8-sig")
    buf = io.BytesIO(encoded_bytes)
    buf.seek(0)
    return buf
