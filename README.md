# Intelligent Cognitive Alarm Platform

The Intelligent Cognitive Alarm Platform is an AI-based alarm and wake-up assistance system that helps users build better wake-up habits, improve consistency, and increase daily productivity through cognitive challenges and personalized recommendations.

**Project Status:** Milestones 1–3 Completed | Milestone 4 In Progress

---

## 1. Problem Statement

Traditional alarms can be easily dismissed or snoozed without ensuring that the user is fully awake. Our platform combines smart alarms, cognitive challenges, wake-up verification, behavioral analysis, habit scoring, and personalized recommendations to encourage better wake-up habits.

---

## 2. Objectives

- Develop a smart alarm management system.
- Provide role-based access for users, wellness coaches, and administrators.
- Manage alarms, sleep schedules, and user preferences.
- Use cognitive challenges for wake-up verification.
- Track wake-up behavior, challenge performance, and habits.
- Adapt challenge difficulty based on performance.
- Calculate habit scores and provide recommendations.
- Provide dashboards for monitoring progress.

---

## 3. Main Modules

### 3.1 User & Habit Management

Manages user profiles, sleep schedules, wake-up goals, productivity goals, and challenge preferences.

### 3.2 Alarm Scheduling

Supports one-time, recurring, daily, weekday, weekend, and smart adaptive alarms.

### 3.3 Cognitive Challenge Engine

Provides wake-up challenges such as math, logic, memory, word games, patterns, riddles, and quizzes.

### 3.4 Adaptive Difficulty

Uses accuracy, response time, attempts, and previous performance to adjust challenge difficulty.

**Levels:** Easy, Medium, Hard

### 3.5 Wake-Up Verification

Users must complete the required challenge before dismissing the alarm, helping verify wakefulness and reduce snoozing.

### 3.6 Behavioral Analytics

Tracks alarm activity, snoozes, wake-up consistency, challenge activity, sleep patterns, and productivity behavior.

### 3.7 Habit Scoring

| Component                | Weight |
| ------------------------ | -----: |
| Wake-Up Consistency      |    35% |
| Challenge Completion     |    25% |
| Snooze Reduction         |    20% |
| Sleep Schedule Adherence |    20% |

### 3.8 Recommendation Engine

Provides personalized suggestions for sleep, wake-up habits, productivity, and challenges.

### 3.9 Dashboard

Displays habit scores, wake-up and challenge performance, behavioral patterns, progress trends, and recommendations.

---

# Milestone 1 — Week 1 & 2

## Project Initialization & Core Setup

Focused on establishing the basic project structure.

**Tasks:**

- Defined objectives and workflows.
- Designed system architecture and database.
- Created UI wireframes.
- Set up frontend, backend, and database.
- Implemented authentication and user roles.
- Added profiles and alarm scheduling.

**Technology:** React.js, HTML, CSS, JavaScript, Python, FastAPI, PostgreSQL.

**Roles:** User, Wellness Coach, Administrator.

**Status:** Completed

### Workflow

```text
Register/Login → Set Preferences → Schedule Alarm
→ Alarm Activates → Cognitive Verification
```

---

# Milestone 2 — Week 3 & 4

## Cognitive Challenges & Wake-Up Verification

Focused on making the alarm interactive and verifying that the user is awake.

**Tasks:**

- Developed the cognitive challenge engine.
- Added challenge generation and evaluation.
- Implemented wake-up verification.
- Added challenge performance tracking.

**Challenge Types:** Math, Logic, Memory, Word, Pattern, Riddle, Quiz.

### Workflow

```text
Alarm Trigger → Challenge Generated → User Answers
→ Answer Evaluated → Correct: Dismiss | Incorrect: Continue
```

**Status:** Completed

---

# Milestone 3 — Week 5 & 6

## Adaptive Intelligence & Recommendations

Focused on personalizing the system using user behavior and challenge performance.

**Tasks:**

- Added adaptive challenge difficulty.
- Implemented behavioral analytics.
- Developed habit scoring.
- Added personalized recommendations.
- Created habit tracking dashboards.

**Adaptive Difficulty:** Uses accuracy, response time, attempts, and previous performance.

**Behavioral Analytics:** Tracks alarms, wake-up completion, snoozes, challenges, and consistency.

**Habit Score:**

```text
Wake-Up Consistency       35%
Challenge Completion      25%
Snooze Reduction          20%
Sleep Adherence           20%
```

**Recommendations:** Personalized suggestions for sleep, wake-up habits, productivity, and challenges.

**Status:** Completed

---

# 4. Technology Stack

**Programming:** Python, JavaScript  
**Backend:** FastAPI  
**Frontend:** React.js, React Native  
**Databases:** PostgreSQL, MongoDB

**AI/ML:** Scikit-learn, XGBoost, TensorFlow, PyTorch, Pandas, NumPy

**Adaptive Intelligence:** Reinforcement Learning, Behavioral Analytics, Recommendation Systems

**Mobile & Notifications:** Firebase Cloud Messaging, Android Alarm Manager, iOS Local Notifications

**Tools:** VS Code, Git, GitHub, Postman

---

# 5. High-Level System Workflow

```text
User Login
    ↓
Profile & Preferences
    ↓
Schedule Alarm
    ↓
Alarm Triggered
    ↓
Cognitive Challenge
    ↓
Wake-Up Verification
    ↓
Behavior Analysis
    ↓
Adaptive Difficulty
    ↓
Habit Score
    ↓
Recommendations
    ↓
Dashboard
```

---

# 6. Milestone Progress

| Milestone   | Weeks | Main Work                                                | Status      |
| ----------- | ----- | -------------------------------------------------------- | ----------- |
| Milestone 1 | 1–2   | Setup, architecture, authentication, profiles, alarms    | Completed   |
| Milestone 2 | 3–4   | Cognitive challenges and verification                    | Completed   |
| Milestone 3 | 5–6   | Analytics, adaptive difficulty, scoring, recommendations | Completed   |
| Milestone 4 | 7–8   | Testing, Docker, deployment, documentation               | In Progress |

---

## 7. Scope

This README covers project development from initial setup through adaptive intelligence and recommendations in **Milestones 1–3**.

**Milestone 4** will focus on final integration, testing, Docker containerization, cloud deployment, monitoring, documentation, and presentation.
