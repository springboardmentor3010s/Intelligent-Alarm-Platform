# CognitiveWake MongoDB Schema

Database: `cognitivewake`

Collections:
- `users`: _id, name, email, password_hash, role, timezone, is_active, created_at, updated_at
- `alarms`: _id, user_id, title, alarm_time, timezone, repeat_days, enabled, sound, volume, snooze_enabled, snooze_duration, max_snoozes, challenge_type, difficulty, number_of_challenges, created_at, updated_at
- `challenges`: _id, type, difficulty, question, options, correct_answer, time_limit, created_by, created_at
- `alarm_sessions`: _id, alarm_id, user_id, triggered_at, completed_at, status, total_attempts, challenges_completed, challenges_failed, total_time, snoozed_count
- `challenge_attempts`: _id, session_id, user_id, alarm_id, challenge_id, answer, correct, response_time, attempted_at
- `performance`: _id, user_id, total_alarms, completed_alarms, failed_alarms, average_response_time, accuracy, current_streak, longest_streak, updated_at
- `notifications`: _id, user_id, type, title, message, is_read, created_at
- `audit_logs`: _id, user_id, action, target_type, target_id, timestamp, metadata

Relationships:
users 1--N alarms
users 1--N alarm_sessions
alarm_sessions 1--N challenge_attempts
challenges 1--N challenge_attempts
users 1--1 performance
users 1--N notifications
users 1--N audit_logs
