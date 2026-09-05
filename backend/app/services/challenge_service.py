"""Challenge service for adaptive difficulty and puzzle generation."""

import random
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.Models import Challenge, User
from ..schemas import ChallengeListRes, ChallengeRes


class ChallengeService:
    """Service for adaptive challenge generation and difficulty management."""

    # Challenge generation templates by type
    CHALLENGE_TEMPLATES = {
        "Math": {
            "generate": lambda: {
                "a": random.randint(1, 50),
                "b": random.randint(1, 12),
            },
            "format_question": lambda a, b: f"What is {a} × {b}?",
            "compute_answer": lambda a, b: a * b,
            "type": "numeric",
        },
        "Logic": {
            "generate": lambda: {
                "pattern": [random.choice(['A', 'B', 'C', 'D']) for _ in range(2)],
            },
            "format_question": lambda pattern: f"Complete the pattern: {' '.join(pattern)} ?",
            "compute_answer": lambda pattern: random.choice(['A', 'B', 'C', 'D']),
            "type": "choice",
        },
        "Memory": {
            "generate": lambda: {
                "sequence": [random.randint(0, 9) for _ in range(5)],
            },
            "format_question": lambda sequence: f"Memorize this sequence: {', '.join(map(str, sequence))}",
            "compute_answer": lambda sequence: ", ".join(map(str, sequence)),
            "type": "sequence",
        },
        "Word": {
            "generate": lambda: {
                "word": "example",
                "scrambled": ''.join(random.sample('example', 7)),
            },
            "format_question": lambda word, scrambled: f"Unscramble: {scrambled}",
            "compute_answer": lambda word, scrambled: word,
            "type": "text",
        },
        "Pattern": {
            "generate": lambda: {
                "shapes": [random.choice(['▲', '▼', '◀', '▶']) for _ in range(2)],
            },
            "format_question": lambda shapes: f"Pattern: {' '.join(shapes)} ?",
            "compute_answer": lambda shapes: random.choice(['▲', '▼', '◀', '▶']),
            "type": "visual",
        },
        "Riddle": {
            "generate": lambda: {
                "riddle": random.choice([
                    ("What has keys but can't open locks?", "piano"),
                    ("What comes once in a minute, twice in a moment, but never in a thousand years?", "the letter M"),
                    ("What can travel around the world while staying in a corner?", "stamp"),
                ]),
            },
            "format_question": lambda riddle: riddle[0],
            "compute_answer": lambda riddle: riddle[1],
            "type": "text",
        },
        "QuickQuiz": {
            "generate": lambda: {
                "question": "Quick quiz: What is 15 + 27?",
                "answer": 42,
            },
            "format_question": lambda question, answer: question,
            "compute_answer": lambda question, answer: answer,
            "type": "numeric",
        },
    }

    @staticmethod
    def _generate_payload(challenge_type: str) -> Dict[str, Any]:
        """Generate challenge payload based on type."""
        if challenge_type in ChallengeService.CHALLENGE_TEMPLATES:
            template = ChallengeService.CHALLENGE_TEMPLATES[challenge_type]
            data = template["generate"]()
            question = template["format_question"](**data) if callable(template["format_question"]) else template["format_question"]
            answer = template["compute_answer"](**data) if callable(template["compute_answer"]) else template["compute_answer"]
            
            return {
                "question": question,
                "answer": str(answer),
                "type": template["type"],
                "data": data,  # Store raw data for validation if needed
            }
        # Default to math
        template = ChallengeService.CHALLENGE_TEMPLATES["Math"]
        data = template["generate"]()
        question = template["format_question"](**data)
        answer = template["compute_answer"](**data)
        
        return {
            "question": question,
            "answer": str(answer),
            "type": template["type"],
            "data": data,
        }

    @classmethod
    async def get_adaptive_challenge(
        cls, db: Session, user_id: int, current_difficulty: str = "Medium"
    ) -> Optional[Challenge]:
        """Get next adaptive challenge based on user performance."""
        # Query user's challenge history to determine difficulty adjustment
        from app.Models import ChallengeAttempt
        
        # Get recent attempts
        recent_attempts = db.query(ChallengeAttempt).filter(
            ChallengeAttempt.user_id == user_id
        ).order_by(ChallengeAttempt.created_at.desc()).limit(5).all()
        
        # Calculate success rate
        if recent_attempts:
            total_questions = sum(a.total_questions for a in recent_attempts)
            correct_total = sum(a.correct_answers for a in recent_attempts)
            success_rate = correct_total / total_questions if total_questions > 0 else 0.5
        else:
            success_rate = 0.5  # Default: medium difficulty
        
        # Compute additional features for ML model
        avg_time = 0.0
        snooze_count = 0
        streak = 0
        if recent_attempts:
            times = [a.time_taken_seconds for a in recent_attempts if a.time_taken_seconds and a.time_taken_seconds > 0]
            avg_time = sum(times) / len(times) if times else 30.0
            
            # Count snoozes from user's alarms
            from app.Models import Alarm
            user_alarms = db.query(Alarm).filter(Alarm.user_id == user_id).all()
            snooze_count = sum(a.times_snoozed for a in user_alarms)
            
            # Compute current streak (consecutive completed challenges)
            for attempt in recent_attempts:
                if attempt.completed:
                    streak += 1
                else:
                    break
        
        # Use ML inference with rule-based fallback
        from .ml_inference import MLInferenceService
        new_difficulty, method = MLInferenceService.predict_difficulty(
            success_rate=success_rate,
            avg_time_seconds=avg_time,
            snooze_count=snooze_count,
            streak_length=streak,
            current_difficulty=current_difficulty,
        )
        
        # Query for active challenge at this difficulty
        challenge = db.query(Challenge).filter(
            Challenge.difficulty == new_difficulty,
            Challenge.is_active == True,
        ).order_by(func.random()).first()
        
        if not challenge:
            # Fallback to any active challenge
            challenge = db.query(Challenge).filter(Challenge.is_active == True).first()
        
        if challenge:
            # Generate puzzle payload
            payload = ChallengeService._generate_payload(challenge.challenge_type)
            
            # Update challenge last generated time
            challenge.generated_at = datetime.utcnow()
            db.add(challenge)
            db.commit()
        
        # Return a challenge reshape even if we need to create one
        # In production, this would be more sophisticated
        return challenge