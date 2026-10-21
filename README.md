<div align="center">

<h1>🧠 Intelligent Cognitive Alarm Platform

Build Better Wake-Up Habits Through Cognitive Challenges

A web-based alarm platform that combines intelligent alarm scheduling, cognitive challenges, habit tracking, and behavioral analytics to support consistent wake-up routines.











Features · Architecture · Installation · Documentation

</div>

<h2>📌 Overview

The Intelligent Cognitive Alarm Platform is designed to make waking up more interactive by combining traditional alarm functionality with cognitive exercises and habit-related insights.

Instead of relying only on dismissing an alarm, the platform can use cognitive challenges as part of the wake-up workflow. User profiles, habit tracking, and behavioral analytics provide a foundation for monitoring routines and supporting more consistent behavior.

The application uses a React frontend, a FastAPI backend, and PostgreSQL for data persistence. Docker Compose simplifies running the application locally.

<h2>🎯 Project Objectives

Provide a centralized interface for managing alarms and wake-up routines.

Integrate cognitive challenges into the alarm-dismissal workflow.

Support user profile and habit management.

Track behavioral information to help users understand their routines.

Provide a foundation for adaptive challenge difficulty and personalized recommendations.

Deliver a modular web application that can be developed and deployed using Docker.

<h2>✨ Key Features

⏰ Alarm Management

Create and manage alarms through the application interface, with configurable alarm settings supported by the backend.

🧩 Cognitive Challenges

Integrate cognitive exercises into the wake-up process to make alarm dismissal more interactive.

👤 User Profiles

Manage user-related information and habit preferences.

📊 Behavioral Analytics

Use recorded behavioral information to support habit tracking and provide insights into user routines.

🧠 Adaptive Difficulty

The project includes adaptive-difficulty-related code intended to support adjusting challenge difficulty based on user performance.

💡 Recommendations

The backend includes recommendation-related functionality intended to support personalized guidance.

🔌 REST API

The backend exposes API endpoints through FastAPI, with interactive API documentation available through Swagger UI.

🐳 Docker-Based Development

Run the frontend and backend in containers using Docker Compose.

Feature availability depends on the implementation, configuration, and completion status of the corresponding workflows.

<h2>🛠️ Technology Stack



| Category          | Technologies            |

| ----------------- | ----------------------- |

| Frontend          | React, JavaScript, Vite |

| Backend           | Python, FastAPI         |

| ORM               | SQLAlchemy              |

| Database          | PostgreSQL              |

| API documentation | FastAPI / Swagger UI    |

| Containerization  | Docker, Docker Compose  |

| Development tools | Git, GitHub, VS Code    |



Additional machine-learning and data-processing dependencies are defined in the backend requirements file.



<h2>🏗️ System Architecture




┌─────────────────────────────────────┐

│             User / Browser          │

└──────────────────┬──────────────────┘

                   │

                   ▼

┌─────────────────────────────────────┐

│         React + Vite Frontend       │

│                                     │

│  • User Interface                   │

│  • Alarm Management                 │

│  • Cognitive Challenge Screens      │

│  • Habit and Analytics Views        │

└──────────────────┬──────────────────┘

                   │ HTTP / REST API

                   ▼

┌─────────────────────────────────────┐

│           FastAPI Backend           │

│                                     │

│  • Authentication and User APIs     │

│  • Alarm and Habit APIs              │

│  • Challenge Workflows               │

│  • Analytics and Recommendations     │

└──────────────────┬──────────────────┘

                   │ SQLAlchemy

                   ▼

┌─────────────────────────────────────┐

│             PostgreSQL              │

│                                     │

│  • User and Profile Data             │

│  • Alarm Data                        │

│  • Challenge and Attempt Data        │

│  • Habit and Behavioral Data         │

└─────────────────────────────────────┘



      Docker Compose

  manages frontend and backend




This diagram represents the intended high-level architecture. The exact data flow depends on the implemented endpoints and database models.


<h2>📂 Repository Structure


Intelligent-Alarm-Platform/

│

├── backend/

│   ├── main.py

│   ├── database.py

│   ├── auth.py

│   ├── routers/

│   ├── Models/

│   ├── services/

│   ├── ml/

│   ├── requirements.txt

│   └── Dockerfile

│

├── frontend/

│   ├── src/

│   ├── public/

│   ├── package.json

│   └── Dockerfile

│

├── docs/

│   ├── Intelligent_Cognitive_Alarm_Platform_Presentation.pptx

│   └── Intelligent_Cognitive_Alarm_Platform_Project_Report.docx

│

├── .env.example

├── .gitignore

├── docker-compose.yml

└── README.md


The structure above describes the intended repository layout. Some files may be added, renamed, or reorganized as the project evolves.

🚀 Getting Started

Follow these instructions to run the project locally.

Prerequisites

Install the following tools:

Git

Docker Desktop

Docker Compose, included with current Docker Desktop installations

PostgreSQL, if running the database separately on your computer

1. Clone the Repository


git clone https://github.com/springboardmentor3010s/Intelligent-Alarm-Platform.git

cd Intelligent-Alarm-Platform


2. Configure Environment Variables

Create your local environment file from the provided template.

Windows Command Prompt:


copy .env.example .env


Open .env in a text editor and configure the PostgreSQL connection string.

Example format:


DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@host.docker.internal:5432/cognitive_alarm

VITE_API_URL=http://localhost:8000


Replace YOUR_PASSWORD with your own PostgreSQL password.

If your password contains special characters, URL-encode them where required by the database connection URL.

Important: The example above assumes PostgreSQL is accessible from Docker at host.docker.internal:5432. Adjust it for your own database setup.

Never commit your actual .env file or publish database credentials.

3. Start the Application

From the directory containing docker-compose.yml, run:


docker compose up -d --build


Docker Compose builds the frontend and backend images and starts the configured services.

4. Verify the Containers


docker compose ps


View the application logs:


docker compose logs --tail=100


Follow logs continuously:


docker compose logs -f


Press Ctrl+C to stop following the logs. This does not stop the running containers.

5. Access the Application

When running with the default port mappings:

| Service                       | URL                        |

| ----------------------------- | -------------------------- |

| Frontend                      | http://localhost:5173      |

| Backend                       | http://localhost:8000      |

| Interactive API documentation | http://localhost:8000/docs |

These addresses are for local development, not a public internet deployment.

6. Stop the Application


docker compose stop


To start the stopped services again:


docker compose start


Avoid removing database volumes or deleting database files unless you fully understand the impact and have a verified backup.

🔌 API Documentation

The backend uses FastAPI to expose HTTP API endpoints.

After starting the backend, open:

http://localhost:8000/docs

Swagger UI provides an interactive interface for inspecting available routes, request parameters, and response schemas.

The exact API capabilities are determined by the routers registered in the backend.

📄 Project Documentation

Project documentation is available in the docs/ directory.

| Document                                                                            | Description                                     |

| ----------------------------------------------------------------------------------- | ----------------------------------------------- |

| Project Presentation                                                                | PowerPoint presentation introducing the project |

| Project Report                                                                      | Project report and supporting documentation     |

🔐 Security and Configuration

Keep credentials in your local .env file.

Commit only a sanitized .env.example containing placeholders.

Exclude database backups, local database files, virtual environments, and dependency directories.

Never publish access tokens, passwords, private keys, or other secrets.

Use a unique database password and rotate credentials that have been exposed.

Review database schema initialization and migration behavior before deploying to a production database.

<h2>🧪 Testing and Validation

The backend repository includes test and verification scripts related to alarm workflows, adaptive difficulty, analytics, recommendations, and other application functionality.

Run tests only after configuring the required dependencies and test database. Verify each workflow in your own environment before treating it as production-ready.


<h2>🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

Fork the repository.

Create a feature branch.

Make your changes.

Test your changes locally.

Submit a pull request describing the changes.

<h2>📜 License

See the LICENSE file in the repository for the applicable license terms.

---

<div align="center">

Intelligent Cognitive Alarm Platform

Building a more interactive approach to waking up.

</div>

