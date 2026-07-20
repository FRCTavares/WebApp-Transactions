"""Explicit exemptions for the Alembic/legacy-SQLite drift check.

`check_migration_drift.py` fails a migration that adds/renames a column or
table without a matching reference in `app/database_migrations.py` (the
legacy startup migration system that patches pre-existing local SQLite
databases, since `Base.metadata.create_all()` only creates tables that don't
exist yet -- it never alters an existing table).

Not every new table needs a legacy mirror: a table that is brand new (no
prior rows anywhere) is created for free by `create_all()` on any existing
local database. Only add these here when a migration adds a table that
`create_all()` already handles correctly with no data backfill required. If
a future addition needs a backfill from other tables (the way
`owed_item_events` did), it belongs in `database_migrations.py` instead, not
here.

Every entry must include a reason so a reviewer can tell exemption from
oversight.
"""

# Tables that are safe to leave to `Base.metadata.create_all()` -- brand new
# tables with no data to backfill from elsewhere.
EXEMPT_TABLES: dict[str, str] = {
    "user_preferences": (
        "New table added in 1a3d5e7f9b20 with no existing rows anywhere; "
        "create_all() creates it for free on any local database."
    ),
    "import_previews": (
        "New table added in c6a8d1e4f920 with no existing rows anywhere; "
        "create_all() creates it for free on any local database."
    ),
}

# (table, column) pairs that are safe to leave unmirrored -- e.g. a column
# added in the same migration that created the table, so no pre-existing
# local row could be missing it.
EXEMPT_COLUMNS: dict[tuple[str, str], str] = {}
