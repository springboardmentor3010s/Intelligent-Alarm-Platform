# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
#!/bin/sh
set -e

echo "Applying database migrations (alembic upgrade head)..."
alembic upgrade head

echo "Starting CerebroKognit API on :8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000