FROM python:3.11-slim

WORKDIR /app

# Minimal runtime deps only (see requirements-runtime.txt) so the image stays
# lean and builds fast. torch is intentionally omitted: ml_inference has a
# documented rule-based fallback (model_loaded reports False in the container).
COPY backend/requirements-runtime.txt /tmp/requirements-runtime.txt
RUN pip install --no-cache-dir --timeout 60 -r /tmp/requirements-runtime.txt

# App code
COPY backend/app /app/app
COPY backend/ml_models /app/ml_models
COPY migrations /app/migrations
COPY alembic.ini /app/alembic.ini
COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

CMD ["sh", "/app/docker-entrypoint.sh"]