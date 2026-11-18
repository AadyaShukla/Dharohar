"""add_organizer_profile_and_booking_fields

Revision ID: b18c9927d14a
Revises: a95b5d7e7656
Create Date: 2026-11-18 13:03:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b18c9927d14a'
down_revision: Union[str, Sequence[str], None] = 'a95b5d7e7656'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with organizer profiles and booking extensions."""
    from backend.database import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Downgrade schema."""
    pass
