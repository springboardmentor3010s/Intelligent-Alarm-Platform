# COGNIA – Intelligent Cognitive Alarm Platform

## 1. Project Overview

COGNIA is an intelligent alarm platform that combines alarm management, cognitive challenges, user habits, analytics, and machine learning.

Unlike a traditional alarm application, COGNIA encourages users to become mentally active after waking up by requiring them to complete cognitive challenges before dismissing the alarm.

The platform also analyzes user performance and behavior to recommend a suitable challenge difficulty.

---

## 2. Key Features

* Smart alarm creation and management
* Cognitive challenges for alarm verification
* Multiple challenge categories
* Adaptive difficulty recommendation
* User authentication and authorization
* Habit tracking
* Challenge performance tracking
* Wake-up history
* Sleep history
* Challenge history
* Analytics dashboard
* Personalized difficulty recommendations
* User profile management

### Challenge Categories

* Mathematics
* Logic Puzzles
* Memory
* Word Games
* Pattern Recognition
* Riddles
* Quick Quiz

### Difficulty Levels

* Beginner
* Easy
* Medium
* Hard
* Expert

---

## 3. Technology Stack

| Layer            | Technology                      |
| ---------------- | ------------------------------- |
| Frontend         | React.js                        |
| Build Tool       | Vite                            |
| Backend          | Python, FastAPI                 |
| API Server       | Uvicorn                         |
| Database         | MongoDB                         |
| Database Tools   | MongoDB Compass / MongoDB Atlas |
| Authentication   | JWT                             |
| Machine Learning | Scikit-learn                    |
| ML Algorithm     | Decision Tree Classifier        |
| Version Control  | Git & GitHub                    |
| Containerization | Docker                          |

---

## 4. System Architecture

```text
                    COGNIA
                       |
                       v
              React Frontend
                       |
                  REST API
                       |
                       v
               FastAPI Backend
                       |
          +------------+------------+
          |            |            |
          v            v            v
    Authentication   Alarm       ML Engine
          |          Logic           |
          |            |             |
          +------------+-------------+
                       |
                       v
                    MongoDB
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Users       Challenges    History
                       |
                       v
                  Analytics
```

### Architecture Flow

```text
User
  ↓
React Interface
  ↓
FastAPI REST API
  ↓
Application Logic
  ↓
MongoDB
  ↓
Performance / History Data
  ↓
Machine Learning
  ↓
Difficulty Recommendation
  ↓
React Dashboard
```

---

## 5. Backend

The backend is developed using **FastAPI**.

It provides REST APIs for:

* User registration
* User login
* User profiles
* Alarm management
* Habit management
* Challenge management
* Challenge evaluation
* Wake-up verification
* Challenge history
* Wake-up history
* Sleep history
* Analytics
* Adaptive difficulty recommendation

The backend communicates with MongoDB using PyMongo.

---

## 6. Database

COGNIA uses MongoDB for storing application data.

### Database Name

```text
cognitive_alarm
```

### Collections

| Collection          | Purpose                             |
| ------------------- | ----------------------------------- |
| `users`             | Stores user account information     |
| `alarms`            | Stores alarm details                |
| `habits`            | Stores user habit information       |
| `challenges`        | Stores cognitive questions          |
| `challenge_history` | Stores completed challenge results  |
| `wakeup_history`    | Stores wake-up verification records |
| `sleep_history`     | Stores sleep-related records        |

MongoDB Compass can be used during development to view and manage the database.

---

## 7. Machine Learning – Adaptive Difficulty

COGNIA includes a machine-learning component for adaptive challenge difficulty.

The purpose of this feature is to avoid giving every user the same difficulty level.

The system uses user performance and behavior-related information to recommend a suitable difficulty.

### Factors Used

* Habit performance
* Challenge accuracy
* Wake-up performance
* Snooze behavior
* Previous difficulty

### ML Model

```text
Algorithm: Decision Tree Classifier
```

The model predicts a recommended difficulty from:

```text
Beginner
   ↓
Easy
   ↓
Medium
   ↓
Hard
   ↓
Expert
```

For example, if a user consistently performs well, the system can recommend a higher difficulty level.

If the user's performance decreases, a lower difficulty can be recommended.

This creates a personalized cognitive challenge experience.

---

## 8. Authentication

COGNIA uses JWT-based authentication.

The authentication flow is:

```text
User Registration
       ↓
Account Created
       ↓
User Login
       ↓
Credentials Verified
       ↓
JWT Token Generated
       ↓
Protected API Access
```

User passwords are stored using password hashing rather than plain-text storage.

---

## 9. Alarm and Challenge Workflow

The main COGNIA workflow is:

```text
Create Alarm
     ↓
Alarm Becomes Active
     ↓
Alarm Time Reached
     ↓
Cognitive Challenge Appears
     ↓
User Provides Answer
     ↓
Answer Evaluated
     ↓
Challenge Result Stored
     ↓
Alarm Verification
     ↓
Wake-up History Updated
```

The user's challenge performance can contribute to future difficulty recommendations.

---

## 10. Analytics

COGNIA provides an analytics dashboard to help understand user performance.

The system can track:

* Total challenges completed
* Challenge accuracy
* Habit score
* Wake-up activity
* Challenge history
* Sleep history
* Recommended difficulty

This information helps provide a more personalized experience.

---

## 11. Frontend Pages

The React frontend contains the following major pages:

### Dashboard

Provides an overview of:

* Next alarm
* Habit score
* Challenge accuracy
* Wake-up statistics
* Morning focus
* Personalized information

### Alarms

Allows users to create and manage alarms and view difficulty recommendations.

### Habits

Displays habit-related information and performance.

### Challenges

Provides cognitive challenges and evaluates user answers.

### Analytics

Displays performance and behavioral statistics.

### Profile

Displays user account information.

---

## 12. Project Structure

```text
Intelligent-Cognitive-Alarm/
│
├── backend/
│   ├── main.py
│   ├── ml_difficulty.py
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── docker-compose.yml
├── .gitignore
├── LICENSE
└── README.md
```

---

## 13. How to Run

### Backend

```powershell
cd backend
python -m uvicorn main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### Frontend

Open another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Vite will provide the frontend URL, for example:

```text
http://localhost:5174/
```

---

## 14. Database Development Setup

During local development, MongoDB can run on:

```text
mongodb://127.0.0.1:27017
```

The COGNIA database is:

```text
cognitive_alarm
```

MongoDB Compass can be used to verify collections and stored documents.

For cloud deployment, MongoDB Atlas can be used as the database service.

---

## 15. Objective

The objective of COGNIA is to transform a conventional alarm into an intelligent cognitive wake-up platform.

The system combines:

```text
Alarm Management
       +
Cognitive Challenges
       +
Habit Tracking
       +
Analytics
       +
Machine Learning
       =
Personalized Wake-up Experience
```

---

## 16. Conclusion

COGNIA demonstrates how modern web technologies and machine learning can be combined to create an intelligent and personalized alarm platform.

The application provides a complete flow from user authentication and alarm management to cognitive challenge evaluation, data storage, analytics, and adaptive difficulty recommendation.
