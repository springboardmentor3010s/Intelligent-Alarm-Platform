# CognitiveWake — VS Code Run Guide

## Requirements
- Python 3.10+
- Node.js 18+
- MongoDB Community Server running locally

## Backend
Open terminal 1:
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
uvicorn app.main:app --reload
```
Backend: http://127.0.0.1:8000
Swagger: http://127.0.0.1:8000/docs

## Frontend
Open terminal 2:
```powershell
cd frontend
npm install
npm run dev
```
Frontend: http://localhost:5173

## Demo accounts
Admin: admin@cognitivewake.com / Admin@123
WellnessCoach: wellness_coach@cognitivewake.com / WellnessCoach@123
User: user@cognitivewake.com / User@123

## MongoDB
The app connects to:
mongodb://localhost:27017
Database:
cognitivewake
