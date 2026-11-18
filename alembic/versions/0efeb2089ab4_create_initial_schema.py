"""create_initial_schema

Revision ID: 0efeb2089ab4
Revises: 
Create Date: 2026-11-18 09:13:07.726991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from backend.database import Base


# revision identifiers, used by Alembic.
revision: str = '0efeb2089ab4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema by creating all defined models and database triggers."""
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    dialect = bind.dialect.name
    if dialect == "sqlite":
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
            BEFORE UPDATE ON audit_logs
            BEGIN
                SELECT RAISE(ABORT, 'Audit log rows are append-only: updates prohibited');
            END;
        """)
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
            BEFORE DELETE ON audit_logs
            BEGIN
                SELECT RAISE(ABORT, 'Audit log rows are append-only: deletes prohibited');
            END;
        """)
    elif dialect == "postgresql":
        op.execute("""
            CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'Audit log rows are append-only: updates and deletes are prohibited';
            END;
            $$ LANGUAGE plpgsql;
        """)
        op.execute("""
            DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
            CREATE TRIGGER trg_prevent_audit_log_update
            BEFORE UPDATE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
        """)
        op.execute("""
            DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
            CREATE TRIGGER trg_prevent_audit_log_delete
            BEFORE DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
        """)


def downgrade() -> None:
    """Downgrade schema by dropping triggers and all defined models."""
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS prevent_audit_log_update;")
        op.execute("DROP TRIGGER IF EXISTS prevent_audit_log_delete;")
    elif dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;")
        op.execute("DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;")
        op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification();")
    Base.metadata.drop_all(bind=bind)
