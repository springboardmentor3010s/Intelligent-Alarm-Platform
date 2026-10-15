"""merge_oauth_and_last_attempt_duration

Revision ID: 7bebde05fa60
Revises: 30cbb29bddab, b2c3d4e5f6a7
Create Date: 2026-10-08 00:07:41.905769

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7bebde05fa60'
down_revision: Union[str, None] = ('30cbb29bddab', 'b2c3d4e5f6a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
