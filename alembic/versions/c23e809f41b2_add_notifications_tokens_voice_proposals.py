"""add notifications, action tokens, and voice proposals

Revision ID: c23e809f41b2
Revises: a1fc67db91a4
Create Date: 2026-11-18 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c23e809f41b2'
down_revision: Union[str, Sequence[str], None] = 'a1fc67db91a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely with inspector checks."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # 1. UserRow columns
    if 'users' in tables:
        user_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'email' not in user_cols:
            op.add_column('users', sa.Column('email', sa.String(), nullable=True))
        if 'notification_preference' not in user_cols:
            op.add_column('users', sa.Column('notification_preference', sa.String(), nullable=False, server_default='whatsapp'))
        if 'opted_out' not in user_cols:
            op.add_column('users', sa.Column('opted_out', sa.Boolean(), nullable=False, server_default='0'))
            op.create_index(op.f('ix_users_opted_out'), 'users', ['opted_out'], unique=False)

    # 2. notification_logs table
    if 'notification_logs' not in tables:
        op.create_table(
            'notification_logs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.String(), nullable=True),
            sa.Column('recipient', sa.String(), nullable=False),
            sa.Column('channel', sa.String(), nullable=False),
            sa.Column('event_type', sa.String(), nullable=False),
            sa.Column('template_name', sa.String(), nullable=False),
            sa.Column('language', sa.String(), nullable=False, server_default='hi'),
            sa.Column('context_data', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
            sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('next_retry_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_notification_logs_id'), 'notification_logs', ['id'], unique=False)
        op.create_index(op.f('ix_notification_logs_user_id'), 'notification_logs', ['user_id'], unique=False)
        op.create_index(op.f('ix_notification_logs_recipient'), 'notification_logs', ['recipient'], unique=False)
        op.create_index(op.f('ix_notification_logs_channel'), 'notification_logs', ['channel'], unique=False)
        op.create_index(op.f('ix_notification_logs_event_type'), 'notification_logs', ['event_type'], unique=False)
        op.create_index(op.f('ix_notification_logs_status'), 'notification_logs', ['status'], unique=False)

    # 3. single_use_action_tokens table
    if 'single_use_action_tokens' not in tables:
        op.create_table(
            'single_use_action_tokens',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('token_hash', sa.String(), nullable=False),
            sa.Column('booking_id', sa.String(), nullable=False),
            sa.Column('artist_id', sa.String(), nullable=False),
            sa.Column('action', sa.String(), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('consumed', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('consumed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_single_use_action_tokens_id'), 'single_use_action_tokens', ['id'], unique=False)
        op.create_index(op.f('ix_single_use_action_tokens_token_hash'), 'single_use_action_tokens', ['token_hash'], unique=True)
        op.create_index(op.f('ix_single_use_action_tokens_booking_id'), 'single_use_action_tokens', ['booking_id'], unique=False)
        op.create_index(op.f('ix_single_use_action_tokens_artist_id'), 'single_use_action_tokens', ['artist_id'], unique=False)
        op.create_index(op.f('ix_single_use_action_tokens_expires_at'), 'single_use_action_tokens', ['expires_at'], unique=False)
        op.create_index(op.f('ix_single_use_action_tokens_consumed'), 'single_use_action_tokens', ['consumed'], unique=False)

    # 4. voice_proposals table
    if 'voice_proposals' not in tables:
        op.create_table(
            'voice_proposals',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('artist_id', sa.String(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=False),
            sa.Column('audio_url', sa.String(), nullable=True),
            sa.Column('transcript', sa.Text(), nullable=False),
            sa.Column('proposed_changes', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='AWAITING_CONFIRMATION'),
            sa.Column('applied', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_voice_proposals_id'), 'voice_proposals', ['id'], unique=False)
        op.create_index(op.f('ix_voice_proposals_artist_id'), 'voice_proposals', ['artist_id'], unique=False)
        op.create_index(op.f('ix_voice_proposals_user_id'), 'voice_proposals', ['user_id'], unique=False)
        op.create_index(op.f('ix_voice_proposals_status'), 'voice_proposals', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('voice_proposals')
    op.drop_table('single_use_action_tokens')
    op.drop_table('notification_logs')
    op.drop_index(op.f('ix_users_opted_out'), table_name='users')
    op.drop_column('users', 'opted_out')
    op.drop_column('users', 'notification_preference')
    op.drop_column('users', 'email')
