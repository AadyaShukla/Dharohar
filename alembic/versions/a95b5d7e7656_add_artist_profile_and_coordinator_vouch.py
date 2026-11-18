"""add_artist_profile_and_coordinator_vouch

Revision ID: a95b5d7e7656
Revises: 0efeb2089ab4
Create Date: 2026-11-18 12:43:08.273643

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a95b5d7e7656'
down_revision: Union[str, Sequence[str], None] = '0efeb2089ab4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with artist profiles and coordinator vouches."""
    from backend.database import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Downgrade schema."""
    pass
