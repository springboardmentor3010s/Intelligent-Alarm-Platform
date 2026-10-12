# CognitiveWake Backend
1. Install MongoDB and make sure it is running.
2. Copy `.env.example` to `.env`.
3. `python -m venv venv`
4. Windows: `venv\Scripts\activate`
5. `pip install -r requirements.txt`
6. `python seed.py`
7. `uvicorn app.main:app --reload`
8. Open http://127.0.0.1:8000/docs
