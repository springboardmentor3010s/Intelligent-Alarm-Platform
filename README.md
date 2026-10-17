# Intelligent Cognitive Alarm Platform

The Intelligent Cognitive Alarm Platform is an AI-based alarm and wake-up assistance system that helps users build better wake-up habits, improve consistency, and increase daily productivity through cognitive challenges, behavioral analysis, and personalized recommendations.

**Project Status: All Four Milestones Completed**

---

## 1. Problem Statement

Traditional alarms can be easily dismissed or snoozed without ensuring that the user is fully awake. This platform combines smart alarms, cognitive challenges, wake-up verification, behavioral analysis, habit scoring, and personalized recommendations to encourage better wake-up habits.

## 2. Objectives

- Develop a smart alarm management system.
- Provide role-based access for users, wellness coaches, and administrators.
- Manage alarms, sleep schedules, and user preferences.
- Use cognitive challenges for wake-up verification.
- Track wake-up behavior, challenge performance, and habits.
- Adapt challenge difficulty based on performance.
- Calculate habit scores and provide recommendations.
- Provide dashboards for monitoring progress.
- Integrate notifications and application services.
- Test and run the application using Docker Compose.

## 3. Main Modules

### 3.1 User and Habit Management
Manages user profiles, preferences, wake-up goals, and habit-related information.

### 3.2 Alarm Scheduling
Supports alarm creation, scheduling, recurring alarms, and alarm management.

### 3.3 Cognitive Challenge Engine
Provides challenges such as mathematics, logic, memory, word games, patterns, riddles, and quizzes.

### 3.4 Adaptive Difficulty
Uses performance information, such as accuracy, response time, attempts, and previous results, to support difficulty adjustment.

**Difficulty Levels:** Easy, Medium, Hard.

### 3.5 Wake-Up Verification
Requires users to complete the configured cognitive challenge as part of the wake-up workflow.

### 3.6 Behavioral Analytics
Tracks alarm activity, challenge performance, wake-up consistency, and user progress.

### 3.7 Habit Scoring

The project's habit-scoring approach considers the following components:

| Component | Weight |
|---|---:|
| Wake-Up Consistency | 35% |
| Challenge Completion | 25% |
| Snooze Reduction | 20% |
| Sleep Schedule Adherence | 20% |

### 3.8 Recommendation Engine
Provides suggestions intended to improve wake-up routines and behavioral consistency.

### 3.9 Dashboard
Displays habit scores, challenge results, behavioral patterns, progress trends, and recommendations.

---

## 4. Milestone 1 — Project Initialization and Core Setup

**Status: Completed**

This milestone established the basic project structure and core functionality.

**Tasks completed:**
- Defined project objectives and workflows.
- Designed the application architecture.
- Prepared the database structure.
- Set up the frontend and backend.
- Implemented authentication and user roles.
- Developed user profiles and alarm management.
- Created the initial dashboard structure.

**Technologies:** React.js, JavaScript, Python, FastAPI, and PostgreSQL.

## 5. Milestone 2 — Cognitive Challenges and Wake-Up Verification

**Status: Completed**

This milestone introduced interactive challenges to the alarm workflow.

**Tasks completed:**
- Developed the cognitive challenge module.
- Implemented challenge answer evaluation.
- Added different challenge types.
- Supported Easy, Medium, and Hard difficulty levels.
- Recorded challenge attempts, accuracy, and response time.
- Implemented retry and snooze-related challenge workflows.
- Developed challenge history and performance analytics.

**Challenge types:** Mathematics, Logic, Memory, Word, Pattern, Riddle, and Quiz.

## 6. Milestone 3 — Adaptive Intelligence and Recommendations

**Status: Completed**

This milestone focused on analyzing user behavior and providing personalized feedback.

**Tasks completed:**
- Implemented adaptive challenge difficulty functionality.
- Integrated machine learning components for performance analysis.
- Developed behavioral analytics.
- Implemented habit scoring.
- Added personalized recommendations.
- Created dashboards for tracking performance and progress.
- Added daily, weekly, monthly, and custom-period analytics where supported.

**Technologies:** Scikit-learn, XGBoost, TensorFlow, PyTorch, Pandas, and NumPy.

## 7. Milestone 4 — Integration, Testing, and Deployment

**Status: Completed**

This milestone focused on bringing the application components together, testing the system, and preparing the application to run in containers.

**Tasks completed:**
- Integrated the frontend, backend, and database services.
- Configured Docker and Docker Compose.
- Set up the PostgreSQL and MongoDB services.
- Integrated Firebase Cloud Messaging.
- Configured backend alarm scheduling and notification functionality.
- Performed API, end-to-end, performance, and security testing.
- Tested application workflows.
- Verified the application services through Docker Compose.
- Prepared project documentation and presentation materials.

## 8. Technology Stack

- **Frontend:** React.js, JavaScript, HTML, CSS
- **Backend:** Python, FastAPI
- **Databases:** PostgreSQL, MongoDB
- **AI and Machine Learning:** Scikit-learn, XGBoost, TensorFlow, PyTorch
- **Data Processing:** Pandas, NumPy
- **Notifications:** Firebase Cloud Messaging
- **Authentication:** JWT-based authentication
- **Visualization:** Chart.js, Plotly
- **Containerization:** Docker, Docker Compose
- **Testing:** Pytest, Postman
- **Development Tools:** Visual Studio Code, Git, GitHub

## 9. High-Level System Workflow

User Login  
↓  
Profile and Preferences  
↓  
Schedule Alarm  
↓  
Alarm Triggered  
↓  
Cognitive Challenge  
↓  
Wake-Up Verification  
↓  
Behavioral Analysis  
↓  
Adaptive Difficulty  
↓  
Habit Score  
↓  
Personalized Recommendations  
↓  
Dashboard

## 10. Deployment

The application is configured to run using Docker Compose, which manages the frontend, backend, and database services.

Start the application from the directory containing the Docker Compose configuration:

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

For the local configuration, the frontend is available at `http://localhost:3000` and the backend API at `http://localhost:8000`, provided the corresponding ports are configured and the services are running.

## 11. Milestone Summary

| Milestone | Main Work | Status |
|---|---|---|
| Milestone 1 | Core setup, authentication, profiles, alarms | Completed |
| Milestone 2 | Cognitive challenges and wake-up verification | Completed |
| Milestone 3 | Adaptive difficulty, analytics, habit scoring, recommendations | Completed |
| Milestone 4 | Integration, testing, Docker, deployment, documentation | Completed |

## 12. Conclusion

The Intelligent Cognitive Alarm Platform combines alarm management, cognitive challenges, adaptive difficulty, behavioral analytics, habit scoring, and personalized recommendations in one application.

The project demonstrates how AI and machine learning components can support personalized wake-up assistance. The application has been developed, integrated, tested, and configured to run using Docker Compose.

**Final Project Status: All Four Milestones Completed.**
