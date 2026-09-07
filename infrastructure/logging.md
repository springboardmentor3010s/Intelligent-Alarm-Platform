# Logging (Real + Planned)

> Logging is **implemented** for the API gateway; richer sinks are planned.

## Implemented
- `backend/app/gateway/logging.py` — `configure_logging()` bootstraps the
  `app` logger (idempotent, disabled uvicorn.access noise, honors `LOG_LEVEL`).
- `backend/app/gateway/middleware.py` — logs every request with fields:
  `request_id`, `method`, `path`, `status`, `duration_ms`, `client`.
  A request/trace ID is generated and echoed back as `X-Request-ID`.

## Format
- Human/structured key=value lines (JSON-friendly) via the gateway logger.

## Planned
- JSON formatter emitter for shipping to a log aggregator (e.g. Loki, ELK).
- Per-request trace-id propagation across async background jobs (see
  `app/workers/`).
- Structured application-domain logs (challenge submitted, alarm dismissed,
  notification sent) with the request ID attached.

## Guidance
- Never log passwords, JWT payloads, or challenge answer keys.
- Use `LOG_LEVEL` (default `INFO`) to control verbosity in deployment.
