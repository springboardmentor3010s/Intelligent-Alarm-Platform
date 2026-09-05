# offline-first-sync

## Purpose & Use Case
Client-side caching and idempotent background telemetry syncing with PostgreSQL. Ensures the mobile app functions offline and synchronizes data when connectivity is restored, without duplicate or lost records.

## Rules & Standard Workflows
1. **Local Cache Schema**: SQLite (via SQLAlchemy-lightweight or Peewee) or Expo SQLite store for offline-first data. Schema must mirror critical PostgreSQL tables (`users`, `alarms`, `challenge_attempts`, `habit_scores`) with a `synced: boolean` flag and `last_sync_at: timestamp`.
2. **Idempotent Sync**: Every sync operation must be idempotent. Use `upsert` (PostgreSQL `ON CONFLICT`) to handle duplicate records. Never assume local changes are the authoritative source; conflict resolution must follow server-first policy for versioned data.
3. **Background Telemetry**: Implement a background sync service that runs every 5 minutes (or on app foreground return). Send: challenge completion events, wake-up timestamps, snooze counts, habit score updates. Batch events in groups of ≤ 20 per HTTP POST.
4. **Connectivity Detection**: Use `NetInfo` (React Native) or `NetInfo` expo package to detect online/offline state. Only attempt sync when transitioning from offline to online.
5. **Error Handling**: If sync fails (network error, validation error), retry with exponential backoff (max 3 attempts). Mark failed records with `retry_count` and `last_retry_at`. On persistent failure, alert user via notification.

## Best Practices & Guardrails
- Use database transactions for sync: wrap entire batch in a single `BEGIN...COMMIT` to ensure atomicity.
- Never trust local data as authoritative; always validate against server schemas before marking `synced = true`.
- Encrypt sensitive telemetry (sleep patterns, habit data) before local caching if PII is involved.
- Log every sync attempt (success/failure/retry) with timestamps and record counts for debugging.
- Keep sync payloads < 10KB per batch; paginate if necessary.

## Skill Invocation
- Trigger when: a user says "setup offline sync", "fix sync bug", or "enable background telemetry".
- Response must include: local cache schema, idempotent upsert pattern, and background sync workflow reference.