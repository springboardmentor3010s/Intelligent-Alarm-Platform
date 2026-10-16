# CerebroKognit API — production-lean runtime image (Phase 9).
# - python:3.11-slim to match the 3.11 containers the suite is verified on.
# - Exact-pinned requirements-runtime.txt for reproducible builds.
# - torch intentionally omitted: the difficulty engine runs its documented
#   rule-based fallback (ml-status reports model_loaded=false in-container).
# - Runs as a non-root user; no dev/test files baked in (see .dockerignore).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Minimal runtime deps only so the image stays lean and builds fast.
COPY backend/requirements-runtime.txt /tmp/requirements-runtime.txt
RUN pip install --timeout 60 -r /tmp/requirements-runtime.txt

# App code + migrations (alembic runs at container start via entrypoint).
# backend/ml_models/ always exists in clones (tracked .gitkeep); the weights
# themselves are gitignored artifacts and simply absent when not trained.
COPY backend/app /app/app
COPY backend/ml_models /app/ml_models
COPY migrations /app/migrations
COPY alembic.ini /app/alembic.ini
COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
# Strip CR defensively: a CRLF working tree (Windows checkout) makes sh read
# `set -e\r` as an illegal option and the container crash-loops.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "/app/docker-entrypoint.sh"]
