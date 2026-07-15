from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

from app.database import is_sqlite_database_url


@dataclass(frozen=True)
class ForeignKeyDefinition:
    table_name: str
    constraint_name: str
    column_name: str
    parent_table: str
    parent_column: str
    ondelete: str


FOREIGN_KEYS = (
    ForeignKeyDefinition(
        table_name="transactions",
        constraint_name="fk_transactions_import_batch_id_import_batches",
        column_name="import_batch_id",
        parent_table="import_batches",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="investment_events",
        constraint_name="fk_investment_events_transaction_id_transactions",
        column_name="transaction_id",
        parent_table="transactions",
        parent_column="id",
        ondelete="SET NULL",
    ),
    ForeignKeyDefinition(
        table_name="investment_events",
        constraint_name=(
            "fk_investment_events_matched_transaction_id_transactions"
        ),
        column_name="matched_transaction_id",
        parent_table="transactions",
        parent_column="id",
        ondelete="SET NULL",
    ),
    ForeignKeyDefinition(
        table_name="investment_events",
        constraint_name=(
            "fk_investment_events_import_batch_id_import_batches"
        ),
        column_name="import_batch_id",
        parent_table="import_batches",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="owed_items",
        constraint_name="fk_owed_items_linked_transaction_id_transactions",
        column_name="linked_transaction_id",
        parent_table="transactions",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="owed_items",
        constraint_name="fk_owed_items_import_batch_id_import_batches",
        column_name="import_batch_id",
        parent_table="import_batches",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="owed_payments",
        constraint_name=(
            "fk_owed_payments_linked_transaction_id_transactions"
        ),
        column_name="linked_transaction_id",
        parent_table="transactions",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="owed_payment_allocations",
        constraint_name=(
            "fk_owed_payment_allocations_owed_payment_id_owed_payments"
        ),
        column_name="owed_payment_id",
        parent_table="owed_payments",
        parent_column="id",
        ondelete="CASCADE",
    ),
    ForeignKeyDefinition(
        table_name="owed_payment_allocations",
        constraint_name=(
            "fk_owed_payment_allocations_owed_item_id_owed_items"
        ),
        column_name="owed_item_id",
        parent_table="owed_items",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="wealth_snapshots",
        constraint_name=(
            "fk_wealth_snapshots_account_id_wealth_accounts"
        ),
        column_name="account_id",
        parent_table="wealth_accounts",
        parent_column="id",
        ondelete="RESTRICT",
    ),
    ForeignKeyDefinition(
        table_name="wealth_snapshots",
        constraint_name=(
            "fk_wealth_snapshots_import_batch_id_import_batches"
        ),
        column_name="import_batch_id",
        parent_table="import_batches",
        parent_column="id",
        ondelete="RESTRICT",
    ),
)


def run_sqlite_foreign_key_migrations(engine: Engine) -> None:
    """Add missing relational foreign keys to legacy SQLite databases."""

    if not is_sqlite_database_url(str(engine.url)):
        return

    with engine.connect() as connection:
        _require_schema(connection)
        _preflight_relationships(connection)

        missing_foreign_keys = _get_missing_foreign_keys(connection)

        if not missing_foreign_keys:
            _require_clean_foreign_key_check(connection)
            return

        _rebuild_tables_with_foreign_keys(
            connection,
            missing_foreign_keys,
        )


def _require_schema(connection: Connection) -> None:
    inspector = inspect(connection)
    table_names = set(inspector.get_table_names())

    for foreign_key in FOREIGN_KEYS:
        if foreign_key.table_name not in table_names:
            raise RuntimeError(
                "Required relationship table does not exist: "
                f"{foreign_key.table_name}"
            )

        if foreign_key.parent_table not in table_names:
            raise RuntimeError(
                "Required relationship table does not exist: "
                f"{foreign_key.parent_table}"
            )

        child_columns = {
            column["name"]
            for column in inspector.get_columns(
                foreign_key.table_name
            )
        }
        parent_columns = {
            column["name"]
            for column in inspector.get_columns(
                foreign_key.parent_table
            )
        }

        if foreign_key.column_name not in child_columns:
            raise RuntimeError(
                "Required relationship column does not exist: "
                f"{foreign_key.table_name}."
                f"{foreign_key.column_name}"
            )

        if foreign_key.parent_column not in parent_columns:
            raise RuntimeError(
                "Required relationship column does not exist: "
                f"{foreign_key.parent_table}."
                f"{foreign_key.parent_column}"
            )

        if "user_id" not in child_columns:
            raise RuntimeError(
                "Required ownership column does not exist: "
                f"{foreign_key.table_name}.user_id"
            )

        if "user_id" not in parent_columns:
            raise RuntimeError(
                "Required ownership column does not exist: "
                f"{foreign_key.parent_table}.user_id"
            )


def _preflight_relationships(connection: Connection) -> None:
    violations: list[str] = []

    for foreign_key in FOREIGN_KEYS:
        orphan_count = int(
            connection.scalar(
                text(
                    f"""
                    SELECT COUNT(*)
                    FROM {foreign_key.table_name} AS child
                    LEFT JOIN {foreign_key.parent_table} AS parent
                      ON parent.{foreign_key.parent_column}
                       = child.{foreign_key.column_name}
                    WHERE child.{foreign_key.column_name} IS NOT NULL
                      AND parent.{foreign_key.parent_column} IS NULL
                    """
                )
            )
            or 0
        )

        cross_user_count = int(
            connection.scalar(
                text(
                    f"""
                    SELECT COUNT(*)
                    FROM {foreign_key.table_name} AS child
                    JOIN {foreign_key.parent_table} AS parent
                      ON parent.{foreign_key.parent_column}
                       = child.{foreign_key.column_name}
                    WHERE child.{foreign_key.column_name} IS NOT NULL
                      AND child.user_id != parent.user_id
                    """
                )
            )
            or 0
        )

        if orphan_count:
            violations.append(
                f"{foreign_key.table_name}."
                f"{foreign_key.column_name}: "
                f"{orphan_count} orphaned reference(s)"
            )

        if cross_user_count:
            violations.append(
                f"{foreign_key.table_name}."
                f"{foreign_key.column_name}: "
                f"{cross_user_count} cross-user reference(s)"
            )

    if violations:
        raise RuntimeError(
            "Legacy foreign-key migration preflight failed: "
            + "; ".join(violations)
        )


def _get_missing_foreign_keys(
    connection: Connection,
) -> tuple[ForeignKeyDefinition, ...]:
    inspector = inspect(connection)
    existing_by_table: dict[
        str,
        set[tuple[str, str, str, str]],
    ] = defaultdict(set)

    for table_name in {
        foreign_key.table_name
        for foreign_key in FOREIGN_KEYS
    }:
        for existing in inspector.get_foreign_keys(table_name):
            constrained_columns = existing.get(
                "constrained_columns"
            ) or []
            referred_columns = existing.get(
                "referred_columns"
            ) or []

            if len(constrained_columns) != 1:
                continue

            if len(referred_columns) != 1:
                continue

            ondelete = (
                (existing.get("options") or {}).get("ondelete")
                or "NO ACTION"
            ).upper()

            existing_by_table[table_name].add(
                (
                    constrained_columns[0],
                    existing["referred_table"],
                    referred_columns[0],
                    ondelete,
                )
            )

    missing: list[ForeignKeyDefinition] = []

    for foreign_key in FOREIGN_KEYS:
        expected = (
            foreign_key.column_name,
            foreign_key.parent_table,
            foreign_key.parent_column,
            foreign_key.ondelete.upper(),
        )

        if expected not in existing_by_table[
            foreign_key.table_name
        ]:
            missing.append(foreign_key)

    return tuple(missing)


def _rebuild_tables_with_foreign_keys(
    connection: Connection,
    missing_foreign_keys: tuple[ForeignKeyDefinition, ...],
) -> None:
    relationships_by_table: dict[
        str,
        list[ForeignKeyDefinition],
    ] = defaultdict(list)

    for foreign_key in missing_foreign_keys:
        relationships_by_table[
            foreign_key.table_name
        ].append(foreign_key)

    if connection.in_transaction():
        connection.commit()

    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")

    enabled = int(
        connection.scalar(text("PRAGMA foreign_keys")) or 0
    )

    if enabled != 0:
        raise RuntimeError(
            "Could not temporarily disable SQLite foreign keys."
        )

    try:
        migration_context = MigrationContext.configure(connection)
        operations = Operations(migration_context)

        for table_name, foreign_keys in (
            relationships_by_table.items()
        ):
            with operations.batch_alter_table(
                table_name,
                recreate="always",
            ) as batch_operations:
                for foreign_key in foreign_keys:
                    batch_operations.create_foreign_key(
                        foreign_key.constraint_name,
                        foreign_key.parent_table,
                        [foreign_key.column_name],
                        [foreign_key.parent_column],
                        ondelete=foreign_key.ondelete,
                    )

        if connection.in_transaction():
            connection.commit()
    finally:
        if connection.in_transaction():
            connection.rollback()

        connection.exec_driver_sql("PRAGMA foreign_keys=ON")

    enabled = int(
        connection.scalar(text("PRAGMA foreign_keys")) or 0
    )

    if enabled != 1:
        raise RuntimeError(
            "SQLite foreign-key enforcement was not restored."
        )

    _require_clean_foreign_key_check(connection)

    remaining = _get_missing_foreign_keys(connection)

    if remaining:
        missing_names = ", ".join(
            foreign_key.constraint_name
            for foreign_key in remaining
        )
        raise RuntimeError(
            "Legacy foreign-key migration did not create: "
            + missing_names
        )


def _require_clean_foreign_key_check(
    connection: Connection,
) -> None:
    violations = connection.execute(
        text("PRAGMA foreign_key_check")
    ).all()

    if violations:
        raise RuntimeError(
            "SQLite foreign_key_check failed after migration: "
            f"{violations}"
        )
