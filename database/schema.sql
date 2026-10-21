CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'user',
    preferred_wake_time VARCHAR(5) DEFAULT '07:00',
    sleep_duration DOUBLE PRECISION DEFAULT 8.0,
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    productivity_goal VARCHAR(255) DEFAULT '',
    difficulty_preference VARCHAR(20) DEFAULT 'medium',
    habit_preferences VARCHAR(500) DEFAULT '',
    role_preference VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alarms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500) DEFAULT '',
    alarm_time VARCHAR(5) NOT NULL,
    alarm_type VARCHAR(30) DEFAULT 'daily',
    days VARCHAR(50) DEFAULT '',
    difficulty VARCHAR(20) DEFAULT 'medium',
    challenge_type VARCHAR(30) DEFAULT 'math',
    is_smart BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    snooze_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    last_triggered TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(500) NOT NULL,
    notification_type VARCHAR(40) DEFAULT 'reminder',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alarm_id INTEGER NULL REFERENCES alarms(id) ON DELETE SET NULL,
    activity_type VARCHAR(40) NOT NULL,
    value DOUBLE PRECISION DEFAULT 0,
    metadata_json VARCHAR(1000) DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alarm_id INTEGER NULL REFERENCES alarms(id) ON DELETE SET NULL,
    challenge_type VARCHAR(30) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    question VARCHAR(1000) NOT NULL,
    answer VARCHAR(255) NOT NULL,
    options VARCHAR(1000) DEFAULT '',
    is_completed BOOLEAN DEFAULT FALSE,
    is_correct BOOLEAN NULL,
    response_time_seconds DOUBLE PRECISION NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS coach_assignments (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_id INTEGER NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_coach_assignment UNIQUE (coach_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_coach_assignments_coach_id ON coach_assignments(coach_id);
CREATE INDEX IF NOT EXISTS ix_coach_assignments_user_id ON coach_assignments(user_id);

CREATE TABLE IF NOT EXISTS login_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_login_events_user_id ON login_events(user_id);
CREATE INDEX IF NOT EXISTS ix_login_events_logged_at ON login_events(logged_at);

CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    suggested_action VARCHAR(500) NOT NULL,
    supporting_metric VARCHAR(300) NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    is_acted_upon BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS alarm_performance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alarm_id INTEGER NOT NULL REFERENCES alarms(id) ON DELETE CASCADE,
    completion_activity_id INTEGER NOT NULL UNIQUE REFERENCES activities(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NULL,
    alarm_title VARCHAR(120) NOT NULL,
    challenge_type VARCHAR(30) NULL,
    difficulty VARCHAR(20) NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    accuracy_pct DOUBLE PRECISION NULL,
    average_response_time_seconds DOUBLE PRECISION NULL,
    snoozes_before_completion INTEGER NULL,
    challenge_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recommendation_id INTEGER NULL REFERENCES recommendations(id),
    recommendation_title VARCHAR(200) NOT NULL,
    recommendation_reason VARCHAR(1000) NOT NULL,
    suggested_action VARCHAR(500) NOT NULL,
    recommendation_priority VARCHAR(20) NOT NULL DEFAULT 'medium'
);

CREATE INDEX IF NOT EXISTS ix_alarm_performance_user_id ON alarm_performance(user_id);
CREATE INDEX IF NOT EXISTS ix_alarm_performance_alarm_id ON alarm_performance(alarm_id);
CREATE INDEX IF NOT EXISTS ix_alarm_performance_session_id ON alarm_performance(session_id);
CREATE INDEX IF NOT EXISTS ix_alarm_performance_completed_at ON alarm_performance(completed_at);