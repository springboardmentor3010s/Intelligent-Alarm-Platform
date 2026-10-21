<div align="center">



\# 🧠 Intelligent Cognitive Alarm Platform



\### Build Better Wake-Up Habits Through Cognitive Challenges



!\[Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge\&logo=python\&logoColor=white)

!\[FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge\&logo=fastapi\&logoColor=white)

!\[React](https://img.shields.io/badge/React-20232A?style=for-the-badge\&logo=react\&logoColor=61DAFB)

!\[PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge\&logo=postgresql\&logoColor=white)

!\[Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge\&logo=docker\&logoColor=white)



</div>

\---



\## 📌 Overview



The \*\*Intelligent Cognitive Alarm Platform\*\* is designed to make waking up more interactive by combining traditional alarm functionality with cognitive exercises and habit-related insights.



Instead of relying only on dismissing an alarm, the platform can use cognitive challenges as part of the wake-up workflow. User profiles, habit tracking, and behavioral analytics provide a foundation for monitoring routines and supporting more consistent behavior.



The application uses a React frontend, a FastAPI backend, and PostgreSQL for data persistence. Docker Compose simplifies running the application locally.



\## 🎯 Project Objectives



\* Provide a centralized interface for managing alarms and wake-up routines.

\* Integrate cognitive challenges into the alarm-dismissal workflow.

\* Support user profile and habit management.

\* Track behavioral information to help users understand their routines.

\* Provide a foundation for adaptive challenge difficulty and personalized recommendations.

\* Deliver a modular web application that can be developed and deployed using Docker.



\## ✨ Key Features



\### ⏰ Alarm Management



Create and manage alarms through the application interface, with configurable alarm settings supported by the backend.



\### 🧩 Cognitive Challenges



Integrate cognitive exercises into the wake-up process to make alarm dismissal more interactive.



\### 👤 User Profiles



Manage user-related information and habit preferences.



\### 📊 Behavioral Analytics



Use recorded behavioral information to support habit tracking and provide insights into user routines.



\### 🧠 Adaptive Difficulty



The project includes adaptive-difficulty-related code intended to support adjusting challenge difficulty based on user performance.



\### 💡 Recommendations



The backend includes recommendation-related functionality intended to support personalized guidance.



\### 🔌 REST API



The backend exposes API endpoints through FastAPI, with interactive API documentation available through Swagger UI.



\### 🐳 Docker-Based Development



Run the frontend and backend in containers using Docker Compose.



> Feature availability depends on the implementation, configuration, and completion status of the corresponding workflows.



\## 🛠️ Technology Stack



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



\## 🏗️ System Architecture



```text

┌─────────────────────────────────────┐

│             User / Browser          │

└──────────────────┬──────────────────┘

&#x20;                  │

&#x20;                  ▼

┌─────────────────────────────────────┐

│         React + Vite Frontend       │

│                                     │

│  • User Interface                   │

│  • Alarm Management                 │

│  • Cognitive Challenge Screens      │

│  • Habit and Analytics Views        │

└──────────────────┬──────────────────┘

&#x20;                  │ HTTP / REST API

&#x20;                  ▼

┌─────────────────────────────────────┐

│           FastAPI Backend           │

│                                     │

│  • Authentication and User APIs     │

│  • Alarm and Habit APIs              │

│  • Challenge Workflows               │

│  • Analytics and Recommendations     │

└──────────────────┬──────────────────┘

&#x20;                  │ SQLAlchemy

&#x20;                  ▼

┌─────────────────────────────────────┐

│             PostgreSQL              │

│                                     │

│  • User and Profile Data             │

│  • Alarm Data                        │

│  • Challenge and Attempt Data        │

│  • Habit and Behavioral Data         │

└─────────────────────────────────────┘



&#x20;      Docker Compose

&#x20;  manages frontend and backend

```



This diagram represents the intended high-level architecture. The exact data flow depends on the implemented endpoints and database models.



\## 📂 Repository Structure



```text

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

│   ├── Intelligent\_Cognitive\_Alarm\_Platform\_Presentation.pptx

│   └── Intelligent\_Cognitive\_Alarm\_Platform\_Project\_Report.docx

│

├── .env.example

├── .gitignore

├── docker-compose.yml

└── README.md

```



\*The structure above describes the intended repository layout. Some files may be added, renamed, or reorganized as the project evolves.\*



\## 🚀 Getting Started



Follow these instructions to run the project locally.



\### Prerequisites



Install the following tools:



\* \[Git](https://git-scm.com/)

\* \[Docker Desktop](https://www.docker.com/products/docker-desktop/)

\* Docker Compose, included with current Docker Desktop installations

\* PostgreSQL, if running the database separately on your computer



\### 1. Clone the Repository



```bash

git clone https://github.com/springboardmentor3010s/Intelligent-Alarm-Platform.git

cd Intelligent-Alarm-Platform

```



\### 2. Configure Environment Variables



Create your local environment file from the provided template.



\*\*Windows Command Prompt:\*\*



```cmd

copy .env.example .env

```



Open `.env` in a text editor and configure the PostgreSQL connection string.



Example format:



```env

DATABASE\_URL=postgresql+psycopg2://postgres:YOUR\_PASSWORD@host.docker.internal:5432/cognitive\_alarm

VITE\_API\_URL=http://localhost:8000

```



Replace `YOUR\_PASSWORD` with your own PostgreSQL password.



If your password contains special characters, URL-encode them where required by the database connection URL.



\*\*Important:\*\* The example above assumes PostgreSQL is accessible from Docker at `host.docker.internal:5432`. Adjust it for your own database setup.



Never commit your actual `.env` file or publish database credentials.



\### 3. Start the Application



From the directory containing `docker-compose.yml`, run:



```bash

docker compose up -d --build

```



Docker Compose builds the frontend and backend images and starts the configured services.



\### 4. Verify the Containers



```bash

docker compose ps

```



View the application logs:



```bash

docker compose logs --tail=100

```



Follow logs continuously:



```bash

docker compose logs -f

```



Press `Ctrl+C` to stop following the logs. This does not stop the running containers.



\### 5. Access the Application



When running with the default port mappings:



| Service                       | URL                        |

| ----------------------------- | -------------------------- |

| Frontend                      | http://localhost:5173      |

| Backend                       | http://localhost:8000      |

| Interactive API documentation | http://localhost:8000/docs |



These addresses are for local development, not a public internet deployment.



\### 6. Stop the Application



```bash

docker compose stop

```



To start the stopped services again:



```bash

docker compose start

```



Avoid removing database volumes or deleting database files unless you fully understand the impact and have a verified backup.



\## 🔌 API Documentation



The backend uses FastAPI to expose HTTP API endpoints.



After starting the backend, open:



\*\*http://localhost:8000/docs\*\*



Swagger UI provides an interactive interface for inspecting available routes, request parameters, and response schemas.



The exact API capabilities are determined by the routers registered in the backend.



\## 📄 Project Documentation



Project documentation is available in the \[`docs/`](docs/) directory.



| Document                                                                            | Description                                     |

| ----------------------------------------------------------------------------------- | ----------------------------------------------- |

| \[Project Presentation](docs/Intelligent\_Cognitive\_Alarm\_Platform\_Presentation.pptx) | PowerPoint presentation introducing the project |

| \[Project Report](docs/Intelligent\_Cognitive\_Alarm\_Platform\_Project\_Report.docx)     | Project report and supporting documentation     |



\## 🔐 Security and Configuration



\* Keep credentials in your local `.env` file.

\* Commit only a sanitized `.env.example` containing placeholders.

\* Exclude database backups, local database files, virtual environments, and dependency directories.

\* Never publish access tokens, passwords, private keys, or other secrets.

\* Use a unique database password and rotate credentials that have been exposed.

\* Review database schema initialization and migration behavior before deploying to a production database.



\## 🧪 Testing and Validation



The backend repository includes test and verification scripts related to alarm workflows, adaptive difficulty, analytics, recommendations, and other application functionality.



Run tests only after configuring the required dependencies and test database. Verify each workflow in your own environment before treating it as production-ready.



\## 🔮 Future Enhancements



Potential areas for further development include:



\* Expanded behavioral analytics and progress visualization.

\* More cognitive challenge types and difficulty levels.

\* Improved personalization based on user performance.

\* Automated testing of end-to-end alarm workflows.

\* Production deployment with HTTPS and secure secret management.

\* Monitoring, logging, and reliability improvements.

\* Responsive UI and accessibility refinements.



These are potential enhancements, not claims that the features are already implemented.



\## 🤝 Contributing



Contributions, bug reports, and suggestions are welcome.



1\. Fork the repository.

2\. Create a feature branch.

3\. Make your changes.

4\. Test your changes locally.

5\. Submit a pull request describing the changes.



\## 📜 License



See the \[`LICENSE`](LICENSE) file in the repository for the applicable license terms.



\---



<div align="center">



\*\*Intelligent Cognitive Alarm Platform\*\*



\*Building a more interactive approach to waking up.\*



</div>



