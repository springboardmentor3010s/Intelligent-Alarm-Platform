"""initial_schema

Revision ID: 7fa49f70d180
Revises: 
Create Date: 2026-10-06 02:17:44.338945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fa49f70d180'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create all tables in dependency order."""
    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), server_default='user', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. user_profiles table
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('preferred_wake_time', sa.Time(), nullable=True),
        sa.Column('sleep_duration', sa.Integer(), nullable=True),
        sa.Column('time_zone', sa.String(length=100), nullable=True),
        sa.Column('difficulty_preference', sa.String(length=50), server_default='medium', nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_profiles_id'), 'user_profiles', ['id'], unique=False)

    # 3. habits table
    op.create_table(
        'habits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('wake_up_goal', sa.String(length=255), nullable=True),
        sa.Column('productivity_goals', sa.Text(), nullable=True),
        sa.Column('habit_preferences', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_habits_id'), 'habits', ['id'], unique=False)

    # 4. announcements table
    op.create_table(
        'announcements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=50), server_default='info', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_announcements_id'), 'announcements', ['id'], unique=False)

    # 5. user_notifications table
    op.create_table(
        'user_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=50), server_default='normal', nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_notifications_id'), 'user_notifications', ['id'], unique=False)
    op.create_index(op.f('ix_user_notifications_user_id'), 'user_notifications', ['user_id'], unique=False)

    # 6. alarms table
    op.create_table(
        'alarms',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('alarm_time', sa.Time(), nullable=False),
        sa.Column('alarm_type', sa.String(length=50), server_default='daily', nullable=True),
        sa.Column('repeat_pattern', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('challenge_type', sa.String(length=50), server_default='math', nullable=False),
        sa.Column('difficulty', sa.String(length=50), server_default='medium', nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alarms_id'), 'alarms', ['id'], unique=False)

    # 7. cognitive_challenges table
    op.create_table(
        'cognitive_challenges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alarm_id', sa.Integer(), nullable=False),
        sa.Column('challenge_type', sa.String(), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('correct_answer', sa.String(), nullable=False),
        sa.Column('difficulty', sa.String(), server_default='medium', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['alarm_id'], ['alarms.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cognitive_challenges_id'), 'cognitive_challenges', ['id'], unique=False)

    # 8. alarm_sessions table
    op.create_table(
        'alarm_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alarm_id', sa.Integer(), nullable=False),
        sa.Column('challenge_id', sa.Integer(), nullable=True),
        sa.Column('user_answer', sa.String(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('session_status', sa.String(), server_default='started', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('snooze_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('response_time_seconds', sa.Integer(), nullable=True),
        sa.Column('dismissal_status', sa.String(length=50), server_default='dismissed', nullable=True),
        sa.ForeignKeyConstraint(['alarm_id'], ['alarms.id'], ),
        sa.ForeignKeyConstraint(['challenge_id'], ['cognitive_challenges.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alarm_sessions_id'), 'alarm_sessions', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - drop all tables in reverse dependency order."""
    # 8. alarm_sessions
    op.drop_index(op.f('ix_alarm_sessions_id'), table_name='alarm_sessions')
    op.drop_table('alarm_sessions')

    # 7. cognitive_challenges
    op.drop_index(op.f('ix_cognitive_challenges_id'), table_name='cognitive_challenges')
    op.drop_table('cognitive_challenges')

    # 6. alarms
    op.drop_index(op.f('ix_alarms_id'), table_name='alarms')
    op.drop_table('alarms')

    # 5. user_notifications
    op.drop_index(op.f('ix_user_notifications_user_id'), table_name='user_notifications')
    op.drop_index(op.f('ix_user_notifications_id'), table_name='user_notifications')
    op.drop_table('user_notifications')

    # 4. announcements
    op.drop_index(op.f('ix_announcements_id'), table_name='announcements')
    op.drop_table('announcements')

    # 3. habits
    op.drop_index(op.f('ix_habits_id'), table_name='habits')
    op.drop_table('habits')

    # 2. user_profiles
    op.drop_index(op.f('ix_user_profiles_id'), table_name='user_profiles')
    op.drop_table('user_profiles')

    # 1. users
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
