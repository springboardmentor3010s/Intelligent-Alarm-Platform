from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user, user_scope
from app.db.database import get_db
from app.models.challenge import Challenge
from app.models.challenge_attempt import ChallengeAttempt
from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.challenge import (
    ChallengeAnswerRequest,
    ChallengeGenerateRequest,
)
from app.services.adaptive_difficulty import (
    adaptive_difficulty_engine,
)
from app.services.behavior_analytics import (
    behavior_analytics_service,
)
from app.services.challenge_engine.engine import (
    challenge_engine,
)
from app.services.reinforcement_learning import (
    reinforcement_learning_service,
)


def _starting_difficulty(db: Session, user_id: int) -> str:
    """Latest attempted level, else the profile preference, else easy."""
    latest = db.execute(
        select(Challenge.difficulty)
        .join(
            ChallengeAttempt,
            ChallengeAttempt.challenge_id == Challenge.id,
        )
        .where(ChallengeAttempt.user_id == user_id)
        .order_by(ChallengeAttempt.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if latest in VALID_DIFFICULTIES:
        return latest

    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    ).scalar_one_or_none()
    if profile and profile.current_difficulty in VALID_DIFFICULTIES:
        return profile.current_difficulty
    return "easy"


router = APIRouter(
    prefix="/challenges",
    tags=["Challenges"],
    dependencies=[Depends(user_scope)],
)

VALID_DIFFICULTIES = {
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
}


@router.post("/generate")
def generate_cognitive_challenge(
    request: ChallengeGenerateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a cognitive challenge using:

    1. Existing rule-based adaptive difficulty engine
       as the baseline.
    2. Q-learning reinforcement learning agent
       as the ML decision layer.

    The RL agent uses the user's recent cognitive
    performance to recommend a difficulty.
    """

    if request.user_id is None:
        request.user_id = current.id

    try:
        # ---------------------------------------------------------
        # 1. Validate user
        # ---------------------------------------------------------

        user = db.get(
            User,
            request.user_id,
        )

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )

        # ---------------------------------------------------------
        # 2. Get behavior analytics
        # ---------------------------------------------------------

        behavior = (
            behavior_analytics_service.get_user_behavior(
                db=db,
                user_id=request.user_id,
            )
        )

        cognitive = behavior[
            "cognitive_behavior"
        ]

        # ---------------------------------------------------------
        # 3. Extract cognitive metrics
        # ---------------------------------------------------------

        accuracy = cognitive[
            "accuracy"
        ]

        if 0 <= accuracy <= 1:
            accuracy = accuracy * 100

        response_time = cognitive[
            "average_response_time"
        ]

        attempts = cognitive[
            "average_attempts"
        ]

        # ---------------------------------------------------------
        # 4. Normalize requested difficulty
        # ---------------------------------------------------------

        # When no level is given (for example from an alarm), start from
        # the level of the user's latest challenge and let the adaptive
        # engine move it up or down from there.
        requested_difficulty = request.difficulty or _starting_difficulty(
            db, request.user_id
        )

        current_difficulty = (
            requested_difficulty.strip().lower()
        )

        if current_difficulty not in VALID_DIFFICULTIES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "difficulty must be beginner, easy, "
                    "medium, hard, or expert."
                ),
            )

        # ---------------------------------------------------------
        # 5. Run existing rule-based adaptive engine
        # ---------------------------------------------------------

        adaptive_result = (
            adaptive_difficulty_engine.get_next_difficulty(
                db=db,
                user_id=request.user_id,
                current_difficulty=current_difficulty,
            )
        )

        rule_based_difficulty = (
            adaptive_result[
                "next_difficulty"
            ]
        )

        # ---------------------------------------------------------
        # 6. Run Q-learning ML agent
        # ---------------------------------------------------------

        rl_recommendation = (
            reinforcement_learning_service.get_recommendation(
                db=db,
                user_id=request.user_id,
                accuracy=accuracy,
                response_time=response_time,
                attempts=attempts,
                current_difficulty=current_difficulty,
            )
        )

        rl_difficulty = (
            rl_recommendation[
                "recommended_difficulty"
            ]
        )

        # ---------------------------------------------------------
        # 7. Decide final difficulty
        # ---------------------------------------------------------
        #
        # If the RL agent has learned a non-zero Q-value
        # for the current state, use the RL recommendation.
        #
        # Otherwise, use the existing rule-based engine.
        #
        # This makes the rule-based engine the fallback
        # during the early learning stage.
        # ---------------------------------------------------------

        q_values = rl_recommendation[
            "q_values"
        ]

        has_learned_q_value = any(
            abs(float(value)) > 0.000001
            for value in q_values.values()
        )

        if has_learned_q_value:
            selected_difficulty = (
                rl_difficulty
            )
            decision_source = "q_learning"
        else:
            selected_difficulty = (
                rule_based_difficulty
            )
            decision_source = (
                "rule_based_fallback"
            )

        # ---------------------------------------------------------
        # 8. Generate challenge
        # ---------------------------------------------------------

        generated_challenge = (
            challenge_engine.generate_challenge(
                challenge_type=request.challenge_type,
                difficulty=selected_difficulty,
            )
        )

        # ---------------------------------------------------------
        # 9. Save challenge
        # ---------------------------------------------------------

        challenge = Challenge(
            challenge_type=generated_challenge[
                "challenge_type"
            ],
            difficulty=generated_challenge[
                "difficulty"
            ],
            question=generated_challenge[
                "question"
            ],
            correct_answer=generated_challenge[
                "correct_answer"
            ],
            options=generated_challenge.get(
                "options"
            ),
            challenge_metadata=generated_challenge.get(
                "metadata"
            ),
        )

        db.add(challenge)
        db.commit()
        db.refresh(challenge)

        # ---------------------------------------------------------
        # 10. Return complete adaptive + ML information
        # ---------------------------------------------------------

        return {
            "success": True,

            "challenge": {
                "id": challenge.id,
                "challenge_type": (
                    challenge.challenge_type
                ),
                "difficulty": (
                    challenge.difficulty
                ),
                "question": challenge.question,
                "options": challenge.options,
            },

            "adaptive": {
                "current_difficulty": (
                    adaptive_result[
                        "current_difficulty"
                    ]
                ),
                "rule_based_difficulty": (
                    rule_based_difficulty
                ),
                "decision": (
                    adaptive_result[
                        "decision"
                    ]
                ),
                "reason": (
                    adaptive_result[
                        "reason"
                    ]
                ),
                "accuracy": (
                    adaptive_result[
                        "accuracy"
                    ]
                ),
                "average_response_time": (
                    adaptive_result[
                        "average_response_time"
                    ]
                ),
                "performance_score": (
                    adaptive_result[
                        "performance_score"
                    ]
                ),
                "attempts_analyzed": (
                    adaptive_result[
                        "attempts_analyzed"
                    ]
                ),
            },

            "machine_learning": {
                "method": "q_learning",
                "decision_source": (
                    decision_source
                ),
                "recommended_difficulty": (
                    rl_difficulty
                ),
                "selected_difficulty": (
                    selected_difficulty
                ),
                "q_values": q_values,
                "state": (
                    rl_recommendation[
                        "state"
                    ]
                ),
                "has_learned_q_value": (
                    has_learned_q_value
                ),
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to generate and save "
                "challenge."
            ),
        ) from error


@router.post("/submit")
def submit_challenge_answer(
    request: ChallengeAnswerRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit an answer for a cognitive challenge.

    The result is converted into a reward and used
    to update the persistent Q-learning table.
    """

    # ---------------------------------------------------------
    # 1. Validate user
    # ---------------------------------------------------------

    user = db.get(
        User,
        request.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    # ---------------------------------------------------------
    # 2. Validate challenge
    # ---------------------------------------------------------

    challenge = db.get(
        Challenge,
        request.challenge_id,
    )

    if challenge is None:
        raise HTTPException(
            status_code=404,
            detail="Challenge not found.",
        )

    # ---------------------------------------------------------
    # 3. Get behavior BEFORE the new attempt
    # ---------------------------------------------------------

    behavior_before = (
        behavior_analytics_service.get_user_behavior(
            db=db,
            user_id=request.user_id,
        )
    )

    cognitive_before = (
        behavior_before[
            "cognitive_behavior"
        ]
    )

    accuracy_before = (
        cognitive_before[
            "accuracy"
        ]
    )

    if 0 <= accuracy_before <= 1:
        accuracy_before = (
            accuracy_before * 100
        )

    response_time_before = (
        cognitive_before[
            "average_response_time"
        ]
    )

    attempts_before = (
        cognitive_before[
            "average_attempts"
        ]
    )

    if attempts_before <= 0:
        attempts_before = 1

    # ---------------------------------------------------------
    # 4. Create previous RL state
    # ---------------------------------------------------------

    previous_state = (
        reinforcement_learning_service.get_state(
            accuracy=accuracy_before,
            response_time=response_time_before,
            attempts=attempts_before,
            current_difficulty=(
                challenge.difficulty
            ),
        )
    )

    # The action experienced by the agent
    # is the difficulty of the challenge.
    action = (
        challenge.difficulty
        .strip()
        .lower()
    )

    # ---------------------------------------------------------
    # 5. Calculate attempt number
    # ---------------------------------------------------------

    previous_attempts = db.scalar(
        select(
            func.count(
                ChallengeAttempt.id
            )
        ).where(
            ChallengeAttempt.user_id
            == request.user_id,
            ChallengeAttempt.challenge_id
            == request.challenge_id,
        )
    ) or 0

    attempt_number = (
        previous_attempts + 1
    )

    # ---------------------------------------------------------
    # 6. Validate submitted answer
    # ---------------------------------------------------------

    submitted_answer = (
        request.answer
        .strip()
        .casefold()
    )

    correct_answer = (
        challenge.correct_answer
        .strip()
        .casefold()
    )

    # Riddles can list several accepted answers.
    accepted_answers = {correct_answer}
    for extra in (
        (challenge.challenge_metadata or {}).get(
            "accepted_answers"
        )
        or []
    ):
        accepted_answers.add(str(extra).strip().casefold())

    is_correct = submitted_answer in accepted_answers

    # ---------------------------------------------------------
    # 7. Save challenge attempt
    # ---------------------------------------------------------

    attempt = ChallengeAttempt(
        user_id=request.user_id,
        challenge_id=request.challenge_id,
        submitted_answer=(
            request.answer.strip()
        ),
        is_correct=is_correct,
        response_time=(
            request.response_time
        ),
        attempt_number=attempt_number,
    )

    try:
        db.add(attempt)
        db.commit()
        db.refresh(attempt)

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save "
                "challenge attempt."
            ),
        ) from error

    # ---------------------------------------------------------
    # 8. Calculate RL reward
    # ---------------------------------------------------------

    reward = (
        reinforcement_learning_service.calculate_reward(
            correct=is_correct,
            response_time=(
                request.response_time
            ),
            attempts=attempt_number,
        )
    )

    # ---------------------------------------------------------
    # 9. Get behavior AFTER the attempt
    # ---------------------------------------------------------

    behavior_after = (
        behavior_analytics_service.get_user_behavior(
            db=db,
            user_id=request.user_id,
        )
    )

    cognitive_after = (
        behavior_after[
            "cognitive_behavior"
        ]
    )

    accuracy_after = (
        cognitive_after[
            "accuracy"
        ]
    )

    if 0 <= accuracy_after <= 1:
        accuracy_after = (
            accuracy_after * 100
        )

    response_time_after = (
        cognitive_after[
            "average_response_time"
        ]
    )

    attempts_after = (
        cognitive_after[
            "average_attempts"
        ]
    )

    if attempts_after <= 0:
        attempts_after = 1

    # ---------------------------------------------------------
    # 10. Create next RL state
    # ---------------------------------------------------------

    next_state = (
        reinforcement_learning_service.get_state(
            accuracy=accuracy_after,
            response_time=response_time_after,
            attempts=attempts_after,
            current_difficulty=(
                challenge.difficulty
            ),
        )
    )

    # ---------------------------------------------------------
    # 11. Update persistent Q-value
    # ---------------------------------------------------------

    try:
        new_q_value = (
            reinforcement_learning_service.update_q_value(
                db=db,
                user_id=request.user_id,
                state=previous_state,
                action=action,
                reward=reward,
                next_state=next_state,
            )
        )

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Challenge was saved, "
                "but RL learning failed."
            ),
        ) from error

    # ---------------------------------------------------------
    # 12. Response message
    # ---------------------------------------------------------

    if is_correct:
        message = (
            "Correct answer! "
            "Challenge completed successfully."
        )
    else:
        message = (
            "Incorrect answer. "
            "Please try again."
        )

    # ---------------------------------------------------------
    # 13. Return result + RL learning information
    # ---------------------------------------------------------

    return {
        "correct": is_correct,
        "message": message,
        "attempt_number": attempt_number,

        "reinforcement_learning": {
            "state_before": {
                "performance": (
                    previous_state[0]
                ),
                "speed": (
                    previous_state[1]
                ),
                "attempt_level": (
                    previous_state[2]
                ),
                "current_difficulty": (
                    previous_state[3]
                ),
            },

            "action": action,

            "reward": reward,

            "state_after": {
                "performance": (
                    next_state[0]
                ),
                "speed": (
                    next_state[1]
                ),
                "attempt_level": (
                    next_state[2]
                ),
                "current_difficulty": (
                    next_state[3]
                ),
            },

            "new_q_value": new_q_value,

            "learning": (
                "q_value_updated"
            ),
        },
    }