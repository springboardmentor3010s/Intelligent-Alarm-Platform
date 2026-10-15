"""add coach_notes table

Revision ID: a1b2c3d4e5f6
Revises: 87c54fa3915e
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '87c54fa3915e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'coach_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_coach_notes_id', 'coach_notes', ['id'])


def downgrade() -> None:
    op.drop_index('ix_coach_notes_id', table_name='coach_notes')
    op.drop_table('coach_notes')
