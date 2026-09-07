# Monitoring (Planned Scaffold)

> Status: **planned** (per plan decision #2 — declared/documented, not fabricated).

## Objectives
- Track service health, latency, error rate, and business metrics (dismissals,
  challenge completions, snooze counts, habit-score trends).
- Surface anomalies and regressions that gate the wake-up verification flow.

## Live / implemented today
- `/health` readiness probe (returns `{"status": "healthy"}`) — used by the
  Docker API healthcheck.
- Structured request logging via the gateway middleware: request/trace IDs,
  method, path, status, duration, client (`X-Request-ID` echoed on responses).

## Planned additions
| Capability | Proposal | Status |
|---|---|---|
| Metrics endpoint | Prometheus `/metrics` exposing request counters/histograms + business counters | planned |
| Dashboards | Grafana dashboards per service (latency, error rate, saturation) | planned |
| Alerting | Alert rules on error-rate/availability SLO breach | planned |
| Distributed tracing | OpenTelemetry trace propagation through gateway | planned |
| Uptime/availability | Track real uptime (currently a placeholder `99.9` in admin analytics) | planned |

## Guidance
- Never collect raw challenge answers in logs (security/privacy).
- Use the gateway request ID as the correlation key in logs and alerts.
