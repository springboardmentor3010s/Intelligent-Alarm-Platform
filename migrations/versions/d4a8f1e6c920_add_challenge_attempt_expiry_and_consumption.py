"""add challenge attempt expiry, consumption, and answer metadata

Revision ID: d4a8f1e6c920
Revises: c7e4a9b2d1f0
Create Date: 2026-09-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a8f1e6c920'
down_revision: Union[str, Sequence[str], None] = 'c7e4a9b2d1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('challenge_attempts', sa.Column('answer_meta', sa.JSON(), nullable=True))
    op.add_column('challenge_attempts', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('challenge_attempts', sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_attempts_expires_at', 'challenge_attempts', ['expires_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_attempts_expires_at', table_name='challenge_attempts')
    op.drop_column('challenge_attempts', 'consumed_at')
    op.drop_column('challenge_attempts', 'expires_at')
    op.drop_column('challenge_attempts', 'answer_meta')
