"""add_snooze_limit_and_coach_note_target_user

Revision ID: c1d2e3f4a5b6
Revises: 7bebde05fa60
Create Date: 2024-01-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = '7bebde05fa60'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('alarms', sa.Column('max_failed_attempts', sa.Integer(), nullable=False, server_default='5'))
    op.add_column('coach_notes', sa.Column('target_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('alarms', 'max_failed_attempts')
    op.drop_column('coach_notes', 'target_user_id')
