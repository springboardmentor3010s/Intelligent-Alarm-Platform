def _milestone_outcomes(*items):
    return list(items)


def _strategy_status(label, active, extra_text, outcomes=None):
    if active:
        return {
            "title": label,
            "status": "operational",
            "summary": extra_text,
            "complete": True,
            "outcomes": outcomes or [],
        }

    return {
        "title": label,
        "status": "pending",
        "summary": extra_text,
        "complete": False,
        "outcomes": outcomes or [],
    }


def evaluate_milestone_status(user, alarms, challenges, dashboard):
    alarms = alarms or []
    challenges = challenges or []
    dashboard = dashboard or {}

    user_has_profile = bool(
        user and (
            getattr(user, "name", None)
            or getattr(user, "email", None)
            or getattr(user, "preferred_wake_time", None)
            or getattr(user, "role_preference", None)
        )
    )

    milestone_1_outcomes = _milestone_outcomes(
        "Understand intelligent alarm and habit formation workflows.",
        "Learn system architecture and database design concepts.",
        "Build frontend and backend project initialization.",
        "Working authentication and alarm scheduling system.",
    )
    milestone_1 = _strategy_status(
        "Project Initialization and Core Setup",
        user_has_profile and bool(alarms) and bool(getattr(user, "preferred_wake_time", None)),
        "Authentication, profile setup, wake time configuration, and first alarm activity are active.",
        milestone_1_outcomes,
    )

    milestone_2_outcomes = _milestone_outcomes(
        "Cognitive challenge engine operational.",
        "Wake-up verification workflows functional.",
        "Challenge evaluation system completed.",
    )
    challenge_has_data = bool(challenges)
    milestone_2 = _strategy_status(
        "Cognitive Challenge Verification",
        challenge_has_data and any(getattr(item, "is_completed", False) for item in challenges),
        "Challenge generation, wake-up verification, and answer tracking are active for user interaction.",
        milestone_2_outcomes,
    )

    raw_habit_score = dashboard.get("habit_score") if dashboard else None
    habit_score = float(raw_habit_score) if raw_habit_score not in (None, "", "null") else 0.0

    milestone_3_outcomes = _milestone_outcomes(
        "Adaptive difficulty engine operational.",
        "Habit scoring system functional.",
        "Recommendation workflows completed.",
    )
    milestone_3 = _strategy_status(
        "Adaptive Intelligence and Recommendations",
        habit_score >= 60 and bool(dashboard.get("recommendations")) and bool(challenges),
        "Adaptive difficulty, habit scoring, and recommendation workflows are live through the dashboard analytics.",
        milestone_3_outcomes,
    )

    milestone_4_outcomes = _milestone_outcomes(
        "Fully deployed production-ready platform.",
        "Cognitive alarm intelligence systems operational.",
        "Complete end-to-end wake-up improvement workflow demonstrable.",
    )
    milestone_4 = _strategy_status(
        "Analytics, Testing and Deployment Readiness",
        milestone_1["complete"] and milestone_2["complete"] and milestone_3["complete"],
        "Dashboard insights, reporting, deployment readiness checks, and validations are ready to demonstrate end-to-end workflow completion.",
        milestone_4_outcomes,
    )

    return {
        "milestone_1": milestone_1,
        "milestone_2": milestone_2,
        "milestone_3": milestone_3,
        "milestone_4": milestone_4,
    }
