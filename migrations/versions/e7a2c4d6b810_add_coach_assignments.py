"""add coach assignments for wellness-coach cohort scoping

Revision ID: e7a2c4d6b810
Revises: d4a8f1e6c920
Create Date: 2026-09-17 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a2c4d6b810'
down_revision: Union[str, Sequence[str], None] = 'd4a8f1e6c920'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'coach_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('coach_id', 'user_id', name='uq_coach_assignments_coach_user'),
    )
    op.create_index('ix_coach_assignments_coach_id', 'coach_assignments', ['coach_id'], unique=False)
    op.create_index('ix_coach_assignments_user_id', 'coach_assignments', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_coach_assignments_user_id', table_name='coach_assignments')
    op.drop_index('ix_coach_assignments_coach_id', table_name='coach_assignments')
    op.drop_table('coach_assignments')
