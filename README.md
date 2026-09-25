# 🧠 Intelligent Cognitive Alarm Platform

An intelligent alarm and wake-up management system that combines **cognitive challenges, wake-up verification, adaptive difficulty, behavioural analytics, and habit scoring** to create a smarter and more personalized wake-up experience.

The project is being developed as an **Infosys Springboard project** using a modern full-stack architecture with **React, FastAPI, PostgreSQL, SQLAlchemy, and Alembic**.

---

# 📌 Table of Contents

* [Project Overview](#-project-overview)
* [Problem Statement](#-problem-statement)
* [Project Objectives](#-project-objectives)
* [Key Features](#-key-features)
* [Technology Stack](#-technology-stack)
* [System Architecture](#-system-architecture)
* [How the System Works](#-how-the-system-works)
* [Backend Architecture](#-backend-architecture)
* [Database Design](#-database-design)
* [Cognitive Challenge Engine](#-cognitive-challenge-engine)
* [Adaptive Difficulty Engine](#-adaptive-difficulty-engine)
* [Wake-Up Verification](#-wake-up-verification)
* [Behaviour Analytics](#-behaviour-analytics)
* [Habit Score Model](#-habit-score-model)
* [Frontend](#-frontend)
* [Current Project Status](#-current-project-status)
* [API Endpoints](#-api-endpoints)
* [Project Structure](#-project-structure)
* [How to Run the Project](#-how-to-run-the-project)
* [Future Enhancements](#-future-enhancements)
* [Conclusion](#-conclusion)

---

# 📖 Project Overview

The **Intelligent Cognitive Alarm Platform** is designed to go beyond a traditional alarm clock.

A normal alarm simply rings at a predefined time. This project introduces an intelligent workflow where the user must interact with the system and complete a cognitive challenge and/or wake-up verification.

The system collects information about the user's interactions and uses that information to understand behavioural patterns.

The platform currently includes:

* Alarm creation and management
* Multiple alarm recurrence options
* Cognitive challenge generation
* Multiple challenge types
* Multiple difficulty levels
* Challenge attempt tracking
* Wake-up verification
* Hold-based wake-up verification
* Adaptive difficulty
* Behaviour analytics
* Habit score calculation
* Habit tracking data preparation
* React-based alarm management interface

---

# 🎯 Problem Statement

Traditional alarm applications provide very limited interaction with the user.

A user can:

* Turn off the alarm
* Snooze repeatedly
* Ignore the alarm
* Develop inconsistent wake-up habits

There is also no meaningful analysis of the user's wake-up behaviour.

This project attempts to solve this by introducing an intelligent alarm workflow where the system:

1. Activates an alarm.
2. Presents a cognitive challenge.
3. Records the user's performance.
4. Verifies that the user is awake.
5. Analyses the user's behaviour.
6. Adjusts future challenge difficulty.
7. Calculates a habit score.

---

# 🎯 Project Objectives

The main objectives are:

* Create and manage personalized alarms.
* Provide cognitive challenges when an alarm is triggered.
* Support different challenge categories.
* Support easy, medium, and hard difficulty levels.
* Record challenge performance.
* Verify whether the user is actually awake.
* Analyse wake-up behaviour.
* Automatically adapt challenge difficulty.
* Calculate a habit score.
* Provide data that can be displayed through a habit tracking dashboard.

---

# 🚀 Key Features

## 1. Alarm Management

Users can create alarms with:

* Alarm name
* Wake-up time
* Recurrence
* Cognitive challenge type
* Difficulty
* Snooze limit
* Enabled/disabled status

Supported recurrence options include:

```text
Once
Every Day
Weekdays
Weekends
```

Users can also:

* Enable alarms
* Disable alarms
* Delete alarms
* Start an alarm manually

---

# 🧠 2. Cognitive Challenge Engine

The platform contains a centralized challenge engine responsible for generating cognitive challenges.

Currently supported challenge types:

```text
Math
Logic
Memory
Word
Pattern
```

Difficulty levels:

```text
Easy
Medium
Hard
```

The central engine is located at:

```text
app/services/challenge_engine/engine.py
```

The engine routes the request to the appropriate generator.

Example:

```text
Challenge Request
       │
       ▼
Challenge Engine
       │
       ├── Math Generator
       ├── Logic Generator
       ├── Memory Generator
       ├── Word Generator
       └── Pattern Generator
```

Each generated challenge contains information such as:

* Question
* Correct answer
* Options when applicable
* Challenge type
* Difficulty
* Metadata

---

# 📊 3. Challenge Attempt Tracking

Every submitted challenge answer is stored in the database.

The system records:

* User ID
* Challenge ID
* Submitted answer
* Correct/incorrect result
* Response time
* Attempt number
* Timestamp

This information is later used by the behavioural analytics and adaptive difficulty systems.

---

# 🔄 4. Adaptive Difficulty Engine

The platform includes an adaptive difficulty engine that analyses the user's recent challenge performance.

The engine considers factors such as:

* Accuracy
* Average response time
* Recent attempts
* Performance score
* Current difficulty

It then decides whether the next challenge should:

```text
Increase difficulty
Keep the same difficulty
Decrease difficulty
```

For example:

```text
Current difficulty: Easy

Recent accuracy: 100%
Average response time: 5.79 seconds
Performance score: 94

Decision:
Increase difficulty

Next difficulty:
Medium
```

This means the challenge difficulty is no longer completely static.

The system can adapt to the user's performance.

---

# 🔐 5. Wake-Up Verification

The platform also contains a wake-up verification system.

After the alarm/challenge workflow, the user must prove that they are awake.

Currently implemented verification method:

```text
Press and Hold
```

The user must hold the verification button for:

```text
3 seconds
```

A circular progress indicator shows the verification progress.

Example:

```text
0% → 25% → 50% → 75% → 100%
```

Once the circle reaches 100%, the verification is submitted to the backend.

The system records:

* User ID
* Alarm ID
* Verification method
* Verification status
* Attempt number
* Response time
* Success/failure
* Creation timestamp
* Completion timestamp

---

# 📈 6. Behaviour Analytics

The behaviour analytics layer combines information from different parts of the system.

It currently analyses three major areas.

## Wake-Up Behaviour

The system calculates:

* Total verifications
* Successful verifications
* Success rate
* Average response time
* Average attempts

Example:

```text
Total verifications:        10
Successful verifications:   5
Success rate:               50%
Average response time:      3.0 seconds
Average attempts:           3.4
```

---

## Cognitive Behaviour

The system analyses challenge performance.

Current metrics include:

* Total challenges
* Correct challenges
* Accuracy
* Average response time

Example:

```text
Total challenges:            5
Correct challenges:          5
Accuracy:                    100%
Average response time:       5.79 seconds
```

---

## Alarm Behaviour

The system tracks:

* Total alarms
* Active alarms

Example:

```text
Total alarms:       5
Active alarms:      5
```

---

# 📊 Behaviour Score

The behaviour analytics service also generates an overall behaviour score.

Example from the current test data:

```text
Consistency Score: 35.0

Behaviour Score:
60.5 / 100
```

The behaviour score is intended to summarize the user's current behavioural patterns based on the collected data.

---

# 🏆 7. Habit Score Model

A separate habit score model has been implemented on top of the behavioural analytics.

The current habit score consists of four components:

| Component             | Weight |
| --------------------- | -----: |
| Wake-up consistency   |    40% |
| Cognitive performance |    30% |
| Response behaviour    |    15% |
| Routine activity      |    15% |

The final score is calculated using a weighted formula.

```text
Habit Score =
    Wake-up Consistency × 0.40
  + Cognitive Performance × 0.30
  + Response Behaviour × 0.15
  + Routine Activity × 0.15
```

---

# 📊 Current Habit Score

Using the current test data:

```text
Wake-up consistency:      50
Cognitive performance:   100
Response behaviour:      100
Routine activity:        100
```

The resulting score is:

```text
Habit Score = 80 / 100
```

Calculation:

```text
50 × 0.40  = 20
100 × 0.30 = 30
100 × 0.15 = 15
100 × 0.15 = 15

Total = 80
```

The habit score is calculated dynamically from the user's stored behaviour data.

---

# 🖥️ Frontend

The frontend is built using **React**.

The current alarm management interface provides:

### Create Alarm

Users can configure:

* Alarm name
* Wake-up time
* Repeat schedule
* Cognitive challenge
* Difficulty
* Snooze limit

### Alarm Cards

Each alarm displays:

* Time
* Status
* Alarm title
* Recurrence
* Challenge type
* Difficulty
* Snooze limit

Actions include:

```text
Start Alarm
Enable / Disable
Delete
```

---

# ⏰ Alarm Workflow

The current user workflow can be represented as:

```text
              User
                │
                ▼
         Create Alarm
                │
                ▼
          Alarm Trigger
                │
                ▼
      Cognitive Challenge
                │
                ▼
       Submit Challenge
                │
                ▼
      Record Performance
                │
                ▼
      Wake-Up Verification
                │
                ▼
       Hold for 3 Seconds
                │
                ▼
        Verify Wake-Up
                │
                ▼
       Behaviour Analytics
                │
        ┌───────┴────────┐
        ▼                ▼
Adaptive Difficulty   Habit Score
        │                │
        └───────┬────────┘
                ▼
       Habit Tracking
          Dashboard
```

---

# 🏗️ System Architecture

The project follows a layered full-stack architecture.

```text
┌─────────────────────────────────────┐
│            React Frontend           │
│                                     │
│  Alarm Management                   │
│  Wake-Up Verification UI            │
│  Habit Tracking Dashboard           │
└──────────────────┬──────────────────┘
                   │ HTTP / REST
                   ▼
┌─────────────────────────────────────┐
│             FastAPI Backend         │
│                                     │
│ Routes                              │
│ ├── Alarms                          │
│ ├── Challenges                      │
│ ├── Wake-Up Verification            │
│ └── Analytics                       │
│                                     │
│ Services                            │
│ ├── Challenge Engine                │
│ ├── Adaptive Difficulty             │
│ ├── Behaviour Analytics             │
│ └── Habit Score                     │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│           SQLAlchemy ORM            │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│          PostgreSQL Database        │
│                                     │
│ Users                               │
│ User Profiles                       │
│ Alarms                              │
│ Challenges                          │
│ Challenge Attempts                  │
│ Wake-Up Verifications               │
└─────────────────────────────────────┘
```

---

# 🗄️ Database Design

The application uses **PostgreSQL** as the relational database.

SQLAlchemy is used as the ORM.

## Main Tables

### Users

Stores user information.

```text
users
```

---

### User Profiles

Stores user-specific preferences and cognitive alarm settings.

```text
user_profiles
```

---

### Alarms

Stores alarm configuration.

```text
alarms
```

Important fields include:

```text
id
user_id
title
alarm_time
recurrence
challenge_type
difficulty
snooze_limit
enabled
created_at
```

---

### Challenges

Stores generated cognitive challenges.

```text
challenges
```

Important fields:

```text
id
challenge_type
difficulty
question
correct_answer
options
challenge_metadata
created_at
```

---

### Challenge Attempts

Stores user performance.

```text
challenge_attempts
```

Important fields:

```text
id
user_id
challenge_id
submitted_answer
is_correct
response_time
attempt_number
created_at
```

---

### Wake-Up Verifications

Stores wake-up verification sessions.

```text
wake_up_verifications
```

Important fields:

```text
id
user_id
alarm_id
status
verification_method
attempt_number
response_time
successful
created_at
completed_at
```

---

# 🔗 Database Relationship Overview

```text
Users
 │
 ├───────────────┐
 │               │
 ▼               ▼
Alarms       Challenge Attempts
 │               │
 │               ▼
 │          Challenges
 │
 ▼
Wake-Up Verifications
```

---

# 🔌 API Endpoints

## Alarm APIs

```text
GET    /alarms/user/{user_id}
POST   /alarms/
PATCH  /alarms/{alarm_id}/toggle
DELETE /alarms/{alarm_id}
```

---

## Challenge APIs

```text
POST /challenges/generate
POST /challenges/submit
```

Example challenge generation:

```json
{
  "challenge_type": "math",
  "difficulty": "easy"
}
```

The backend generates and stores the challenge.

---

## Wake-Up Verification APIs

```text
POST /wake-up-verification/start
POST /wake-up-verification/complete
```

The frontend starts a verification session and later submits the result.

---

## Analytics APIs

The analytics layer is designed to expose:

```text
GET /analytics/behavior/{user_id}

GET /analytics/habit-score/{user_id}

GET /analytics/summary/{user_id}
```

These APIs allow the React dashboard to consume the calculated analytics.

---

# 📁 Project Structure

Current backend structure:

```text
backend/
│
├── app/
│   │
│   ├── main.py
│   │
│   ├── core/
│   │   └── config.py
│   │
│   ├── db/
│   │   ├── base.py
│   │   └── database.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── profile.py
│   │   ├── alarm.py
│   │   ├── challenge.py
│   │   ├── challenge_attempt.py
│   │   └── wake_up_verification.py
│   │
│   ├── schemas/
│   │   ├── alarm.py
│   │   ├── challenge.py
│   │   └── wake_up_verification.py
│   │
│   ├── routes/
│   │   ├── alarms.py
│   │   ├── challenges.py
│   │   ├── wake_up_verification.py
│   │   └── analytics.py
│   │
│   └── services/
│       │
│       ├── adaptive_difficulty.py
│       ├── behavior_analytics.py
│       ├── habit_score.py
│       │
│       └── challenge_engine/
│           ├── engine.py
│           ├── math_generator.py
│           ├── logic_generator.py
│           ├── memory_generator.py
│           └── word_generator.py
│
├── alembic/
│
├── alembic.ini
│
├── test_adaptive.py
├── test_behavior_analytics.py
└── test_habit_score.py
```

---

# ⚙️ Technology Stack

## Frontend

* React
* JavaScript / JSX
* React Router
* Fetch API
* CSS / inline styling

## Backend

* Python
* FastAPI
* SQLAlchemy
* Pydantic
* Uvicorn

## Database

* PostgreSQL
* Psycopg

## Database Migration

* Alembic

## Development Tools

* Visual Studio Code
* PowerShell
* Swagger / OpenAPI

---

# ▶️ How to Run the Backend

Navigate to the backend:

```powershell
cd "C:\Users\LOQ\Desktop\intelligent-cognitive-alarm-platform\backend"
```

Activate the virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Start FastAPI:

```powershell
uvicorn app.main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

---

# 🧪 Testing the Intelligence Modules

### Adaptive Difficulty

```powershell
python test_adaptive.py
```

### Behaviour Analytics

```powershell
python test_behavior_analytics.py
```

### Habit Score

```powershell
python test_habit_score.py
```

Example habit score output:

```text
========== HABIT SCORE ==========

Habit Score: 80.0 / 100

Components:
  wake_up_consistency: 50.0
  cognitive_performance: 100.0
  response_behavior: 100
  routine_activity: 100

Weights:
  wake_up_consistency: 0.4
  cognitive_performance: 0.3
  response_behavior: 0.15
  routine_activity: 0.15

Analysis Period: 7 days

=================================
```

---

# 🔄 Complete System Flow

The complete intelligent workflow is:

```text
1. User creates an alarm
          ↓
2. Alarm is stored in PostgreSQL
          ↓
3. Alarm starts
          ↓
4. Cognitive challenge is generated
          ↓
5. Challenge is presented to user
          ↓
6. User submits answer
          ↓
7. Attempt + response time are stored
          ↓
8. Wake-up verification starts
          ↓
9. User holds verification button
          ↓
10. Verification result is stored
          ↓
11. Behaviour analytics processes recent data
          ↓
12. Adaptive engine evaluates cognitive performance
          ↓
13. Next challenge difficulty is determined
          ↓
14. Habit score is calculated
          ↓
15. Analytics are exposed to frontend
          ↓
16. Habit Tracking Dashboard displays results
```

---

# 🧠 What Makes the Project Intelligent?

The important part of the project is that it is not only an alarm CRUD application.

The system uses historical interaction data to influence future behaviour.

For example:

```text
Previous Performance
        │
        ▼
Accuracy + Response Time
        │
        ▼
Adaptive Difficulty
        │
        ▼
Future Challenge Difficulty
```

At the same time:

```text
Wake-up History
      +
Challenge History
      +
Alarm Activity
      │
      ▼
Behaviour Analytics
      │
      ▼
Habit Score
      │
      ▼
Habit Tracking Dashboard
```

Therefore, the platform creates a feedback loop:

```text
User Behaviour
      ↓
Data Collection
      ↓
Analysis
      ↓
Personalization
      ↓
Future User Experience
      ↓
New Behaviour
      ↓
New Data
```

---

# 📌 Current Project Status

| Module                        | Status            |
| ----------------------------- | ----------------- |
| FastAPI Backend               | ✅ Completed       |
| PostgreSQL Integration        | ✅ Completed       |
| SQLAlchemy ORM                | ✅ Completed       |
| Alembic Migrations            | ✅ Implemented     |
| User Model                    | ✅ Completed       |
| User Profile Model            | ✅ Completed       |
| Alarm Management              | ✅ Completed       |
| Alarm Enable/Disable          | ✅ Completed       |
| Alarm Delete                  | ✅ Completed       |
| Cognitive Challenge Engine    | ✅ Completed       |
| Math Challenges               | ✅ Completed       |
| Logic Challenges              | ✅ Completed       |
| Memory Challenges             | ✅ Completed       |
| Word Challenges               | ✅ Completed       |
| Pattern Support               | ✅ Added to schema |
| Challenge Attempt Tracking    | ✅ Completed       |
| Wake-Up Verification          | ✅ Completed       |
| Circular Hold Verification UI | ✅ Completed       |
| Adaptive Difficulty Engine    | ✅ Completed       |
| Behaviour Analytics           | ✅ Completed       |
| Behaviour Score               | ✅ Completed       |
| Habit Score Model             | ✅ Completed       |
| Analytics API Layer           | 🔄 In Progress    |
| Habit Tracking Dashboard      | 🔄 In Progress    |
| Advanced Habit Trends         | 🔄 Planned        |

---

# 🔮 Future Enhancements

The following features can be added in future development:

## 1. Habit Tracking Dashboard

A dedicated dashboard showing:

* Habit Score
* Behaviour Score
* Wake-up consistency
* Cognitive performance
* Response time
* Recent activity
* Progress trends

---

## 2. Historical Trend Analysis

Instead of only looking at the current 7-day period, the system can display:

```text
7 Days
30 Days
90 Days
```

and show changes over time.

---

## 3. Personalized Challenge Selection

The system can eventually learn which challenge types work best for the user.

For example:

```text
Math       → Strong
Memory     → Moderate
Logic      → Strong
Word       → Needs improvement
```

The challenge engine could then personalize future alarm challenges.

---

## 4. Smarter Habit Score

The habit score can eventually incorporate:

* Long-term consistency
* Snooze behaviour
* Missed alarms
* Challenge difficulty progression
* Day-of-week patterns
* Historical improvement
* Consecutive successful wake-ups

---

## 5. Notifications

Future versions can include:

* Browser notifications
* Reminder notifications
* Alarm sound
* Missed alarm notifications

---

## 6. Authentication

A production version should replace the current development user ID approach with:

* User registration
* Login
* Password hashing
* JWT authentication
* Protected API endpoints
* User-specific dashboards

---

# 🎓 Project Significance

The Intelligent Cognitive Alarm Platform demonstrates the integration of:

```text
Full Stack Development
        +
Database Management
        +
REST APIs
        +
Cognitive Challenge Generation
        +
Behaviour Analytics
        +
Adaptive Systems
        +
Personalization
```

The project demonstrates how behavioural data can be collected, analysed, and used to personalize the user's interaction with an application.

---

# 👥 Project Type

**Project:** Intelligent Cognitive Alarm Platform

**Program:** Infosys Springboard

**Domain:**

```text
Artificial Intelligence
Machine Learning / Adaptive Systems
Full Stack Development
Behaviour Analytics
```

---

# 📜 Conclusion

The Intelligent Cognitive Alarm Platform extends the concept of a traditional alarm into an interactive and data-driven system.

The current implementation can:

* Manage alarms.
* Generate cognitive challenges.
* Track challenge performance.
* Verify wake-up interaction.
* Analyse user behaviour.
* Adapt challenge difficulty.
* Calculate a habit score.
* Prepare analytics for a personalized dashboard.

The next major development stage is completing the **Habit Tracking Dashboard**, which will visualize these intelligence layers and provide users with a clear view of their wake-up patterns and progress.

---

## ⭐ Project Pipeline

```text
                 INTELLIGENT
               COGNITIVE ALARM
                   PLATFORM
                       │
          ┌────────────┴────────────┐
          │                         │
      ALARM SYSTEM            COGNITIVE SYSTEM
          │                         │
          ▼                         ▼
      Scheduling              Challenge Engine
          │                         │
          ▼                         ▼
 Wake-Up Verification        Challenge Attempts
          │                         │
          └────────────┬────────────┘
                       ▼
              BEHAVIOUR ANALYTICS
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
     Adaptive Difficulty      Habit Score
             │                   │
             └─────────┬─────────┘
                       ▼
             HABIT TRACKING
                DASHBOARD
                       │
                       ▼
              PERSONALIZATION
```

**Status: 🚀 Active Development**
