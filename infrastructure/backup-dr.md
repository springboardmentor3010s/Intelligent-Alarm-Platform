# Backup & Disaster Recovery (Planned)

> Status: **planned** (declared/documented; not implemented per plan decision #2).

## Database
- Source of truth: PostgreSQL (Docker compose `postgres:15-alpine`).
- Local/fully-self-contained mode uses SQLite (`cerebrokognit.db`) with
  auto-init bootstrap; no server backup applies there.

## Proposed backups
| Item | Proposal | Frequency | Status |
|---|---|---|---|
| Postgres dump | `pg_dump` to encrypted object storage (S3 planned) | Daily + pre-migration | planned |
| WAL archive | Continuous archiving for point-in-time recovery | Continuous | planned |
| Schema/migrations | Alembic revisions committed to git (`migrations/versions/`) | On each schema change | real |
| Config/env | `.env.example` documents all env vars | On change | real |

## Recovery procedure (proposed)
1. Restore latest base dump + replay WAL to target timestamp.
2. Run `alembic upgrade head` to reach the current schema revision.
3. Start the API (Docker entrypoint already runs `alembic upgrade head`).
4. Smoke `smoke_m1.py` + `smoke_m2.py` to validate data integrity.

## RPO/RTO targets (planned)
- RPO ≤ 15 min (WAL replay), RTO ≤ 60 min (base restore + migration).
