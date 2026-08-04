"""Legacy SQLite startup migration for the pending_signups table.

Kept in its own module (rather than database_migrations.py) purely to stay
under this project's file-size limits - database_migrations.py is already
close to its ceiling. See database_foreign_key_migrations.py for the same
pattern used for an unrelated migration.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import is_sqlite_database_url


def run_pending_signup_migrations(engine: Engine) -> None:
    if not is_sqlite_database_url(str(engine.url)):
        return

    inspector = inspect(engine)

    if "pending_signups" in inspector.get_table_names():
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE pending_signups ("
                "id INTEGER NOT NULL, "
                "user_id VARCHAR(100) NOT NULL, "
                "email VARCHAR(255) NOT NULL, "
                "status VARCHAR(20) NOT NULL DEFAULT 'pending', "
                "requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "decided_at DATETIME, "
                "decided_by VARCHAR(255), "
                "PRIMARY KEY (id), "
                "CONSTRAINT uq_pending_signups_email UNIQUE (email), "
                "CONSTRAINT ck_pending_signups_status_known "
                "CHECK (status IN ('pending', 'approved', 'denied'))"
                ")"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_pending_signups_user_id "
                "ON pending_signups (user_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_pending_signups_email "
                "ON pending_signups (email)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_pending_signups_status "
                "ON pending_signups (status)"
            )
        )
