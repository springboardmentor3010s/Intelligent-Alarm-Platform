# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""add per-alarm question_count (FR-WV-002)

Revision ID: a7d3e5f1b9c2
Revises: f2b1d8e4a903
Create Date: 2026-10-16 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d3e5f1b9c2'
down_revision: Union[str, Sequence[str], None] = 'f2b1d8e4a903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('alarms', sa.Column('question_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('alarms', 'question_count')
