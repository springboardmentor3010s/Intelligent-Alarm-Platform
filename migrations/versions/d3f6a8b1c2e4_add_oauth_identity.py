# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""add OAuth2 identity link on users (Module 1)

Revision ID: d3f6a8b1c2e4
Revises: a7d3e5f1b9c2
Create Date: 2026-10-16 00:00:00.000000

Adds `oauth_provider` / `oauth_subject` (NULL for password accounts) plus a
unique (provider, subject) constraint, and relaxes `hashed_password` to
nullable so Google-only accounts can exist without a local password.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f6a8b1c2e4'
down_revision: Union[str, Sequence[str], None] = 'a7d3e5f1b9c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch mode so SQLite (no direct ALTER COLUMN) recreates the table; on
    # PostgreSQL this compiles to plain ALTER TABLE statements.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("oauth_provider", sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column("oauth_subject", sa.String(length=255), nullable=True))
        batch_op.alter_column(
            "hashed_password",
            existing_type=sa.String(length=256),
            nullable=True,
        )
        batch_op.create_unique_constraint(
            "uq_users_oauth_identity", ["oauth_provider", "oauth_subject"]
        )
    # SQLite batch mode recreates the table and cannot reflect the expression
    # index, so restore it. Idempotent on both SQLite and PostgreSQL.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_email_lower ON users (lower(email))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_oauth_identity", type_="unique")
        batch_op.alter_column(
            "hashed_password",
            existing_type=sa.String(length=256),
            nullable=False,
        )
        batch_op.drop_column("oauth_subject")
        batch_op.drop_column("oauth_provider")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_email_lower ON users (lower(email))"
    )
